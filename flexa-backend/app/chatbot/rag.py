"""
rag.py — Hybrid (BM25 + FAISS) semantic + lexical retrieval for FLEXA.

At startup, loads two dual-index pairs:
  Fitness:
    • fitness_qa.index (FAISS) + fitness_qa.bm25 (BM25)
  Nutrition:
    • nutrition.index (FAISS) + nutrition.bm25 (BM25)

Call `retrieve(query, top_k=5)` to get relevant text chunks via hybrid search.
Uses intent routing + reciprocal rank fusion (RRF) to merge lexical + semantic results.
"""
from __future__ import annotations
import os
import json
import logging
import time
import hashlib
import pickle
import re
from collections import OrderedDict
from pathlib import Path
from threading import Lock
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Paths
_BASE = Path(__file__).resolve().parents[2] / "data" / "faiss"
_FITNESS_INDEX = _BASE / "fitness_qa.index"
_FITNESS_DOCS  = _BASE / "fitness_qa_docs.json"
_FITNESS_BM25  = _BASE / "fitness_qa.bm25"
_NUTRITION_INDEX = _BASE / "nutrition.index"
_NUTRITION_DOCS  = _BASE / "nutrition_docs.json"
_NUTRITION_BM25  = _BASE / "nutrition.bm25"

# Lazy singletons
_model = None
_fitness_index = None
_fitness_docs: list[str] = []
_fitness_bm25 = None
_nutrition_index = None
_nutrition_docs: list[str] = []
_nutrition_bm25 = None

# Retrieval tuning
_DEFAULT_TOP_K = int(os.getenv("RAG_TOP_K", "3"))
_CANDIDATE_MULTIPLIER = int(os.getenv("RAG_CANDIDATE_MULTIPLIER", "2"))
_MIN_SCORE = float(os.getenv("RAG_MIN_SCORE", "0.18"))
_MAX_CONTEXT_CHARS = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "1800"))

# Simple in-memory LRU caches for fast repeat queries
_QUERY_CACHE_TTL_S = int(os.getenv("RAG_QUERY_CACHE_TTL_S", "900"))
_QUERY_CACHE_SIZE = int(os.getenv("RAG_QUERY_CACHE_SIZE", "512"))
_EMBED_CACHE_SIZE = int(os.getenv("RAG_EMBED_CACHE_SIZE", "1024"))
_query_cache: "OrderedDict[str, tuple[float, str]]" = OrderedDict()
_embed_cache: "OrderedDict[str, np.ndarray]" = OrderedDict()
_cache_lock = Lock()


def _normalize_query(query: str) -> str:
    return " ".join((query or "").strip().lower().split())


def _cache_get_query(key: str) -> Optional[str]:
    now = time.time()
    with _cache_lock:
        item = _query_cache.get(key)
        if not item:
            return None
        ts, value = item
        if now - ts > _QUERY_CACHE_TTL_S:
            _query_cache.pop(key, None)
            return None
        _query_cache.move_to_end(key)
        return value


def _cache_set_query(key: str, value: str) -> None:
    with _cache_lock:
        _query_cache[key] = (time.time(), value)
        _query_cache.move_to_end(key)
        while len(_query_cache) > _QUERY_CACHE_SIZE:
            _query_cache.popitem(last=False)


def _cache_get_embed(key: str) -> Optional[np.ndarray]:
    with _cache_lock:
        vec = _embed_cache.get(key)
        if vec is None:
            return None
        _embed_cache.move_to_end(key)
        return vec


def _cache_set_embed(key: str, vec: np.ndarray) -> None:
    with _cache_lock:
        _embed_cache[key] = vec
        _embed_cache.move_to_end(key)
        while len(_embed_cache) > _EMBED_CACHE_SIZE:
            _embed_cache.popitem(last=False)


def _hash_doc(doc: str) -> str:
    return hashlib.sha1(doc.encode("utf-8", errors="ignore")).hexdigest()


def _resolve_index_plan(intent: str, query_norm: str):
    """Pick the fastest primary index first, with an optional fallback."""
    nutrition_first = intent in ("nutrition", "diet_plan", "recipe") or (
        bool(re.search(r"\b(calorie|calories|protein|carb|carbs|fat|macro|macros|meal|food|nutrition|diet|recipe|portion|eat|eating|breakfast|lunch|dinner|snack|pre\s*workout|post\s*workout)\b", query_norm, re.IGNORECASE))
        and not bool(re.search(r"\b(workout|exercise|training|gym|squat|bench|deadlift|push[- ]?up|pull[- ]?up|cardio|strength|muscle|sets?|reps?|rpe|injur|pain|mobility|warm[- ]?up|cool[- ]?down|progressive|overload|program|split)\b", query_norm, re.IGNORECASE))
    )
    fitness_first = intent in ("workout_plan", "weight_loss", "weight_gain", "progress", "motivation", "bmi", "general_fitness") or bool(
        re.search(r"\b(workout|exercise|training|gym|squat|bench|deadlift|push[- ]?up|pull[- ]?up|cardio|strength|muscle|sets?|reps?|rpe|injur|pain|mobility|warm[- ]?up|cool[- ]?down|progressive|overload|program|split)\b", query_norm, re.IGNORECASE)
    )

    if nutrition_first and not fitness_first:
        return [
            ("nutrition", _nutrition_index, _nutrition_bm25, _nutrition_docs),
            ("fitness", _fitness_index, _fitness_bm25, _fitness_docs),
        ]

    if fitness_first and not nutrition_first:
        return [
            ("fitness", _fitness_index, _fitness_bm25, _fitness_docs),
            ("nutrition", _nutrition_index, _nutrition_bm25, _nutrition_docs),
        ]

    return [
        ("fitness", _fitness_index, _fitness_bm25, _fitness_docs),
        ("nutrition", _nutrition_index, _nutrition_bm25, _nutrition_docs),
    ]


def _best_score(results: list[tuple[float, str]]) -> float:
    return results[0][0] if results else 0.0


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _load_index(index_path: Path, docs_path: Path):
    """Load a FAISS index + doc list from disk. Returns (index, docs) or (None, [])."""
    if not index_path.exists() or not docs_path.exists():
        logger.warning(f"RAG index not found at {index_path}. Run scripts/build_rag_index.py first.")
        return None, []
    try:
        import faiss  # type: ignore
        index = faiss.read_index(str(index_path))
        with open(docs_path, encoding="utf-8") as f:
            docs = json.load(f)
        logger.info(f"Loaded RAG index: {index_path.name} ({index.ntotal} vectors)")
        return index, docs
    except Exception as e:
        logger.error(f"Failed to load RAG index {index_path}: {e}")
        return None, []


def _load_bm25_index(bm25_path: Path):
    """Load a BM25 index from disk. Returns BM25 object or None."""
    if not bm25_path.exists():
        logger.warning(f"BM25 index not found at {bm25_path}. Run scripts/build_rag_index.py first.")
        return None
    try:
        with open(bm25_path, "rb") as f:
            bm25 = pickle.load(f)
        logger.info(f"Loaded BM25 index: {bm25_path.name}")
        return bm25
    except Exception as e:
        logger.error(f"Failed to load BM25 index {bm25_path}: {e}")
        return None


def _ensure_loaded():
    global _fitness_index, _fitness_docs, _fitness_bm25, _nutrition_index, _nutrition_docs, _nutrition_bm25
    if _fitness_index is None:
        _fitness_index, _fitness_docs = _load_index(_FITNESS_INDEX, _FITNESS_DOCS)
        _fitness_bm25 = _load_bm25_index(_FITNESS_BM25)
    if _nutrition_index is None:
        _nutrition_index, _nutrition_docs = _load_index(_NUTRITION_INDEX, _NUTRITION_DOCS)
        _nutrition_bm25 = _load_bm25_index(_NUTRITION_BM25)


def _rrf_score(rank: int, k: int = 60) -> float:
    """Reciprocal Rank Fusion: score = 1 / (k + rank). Higher is better."""
    return 1.0 / (k + rank)


def _hybrid_search(
    query_vec: np.ndarray,
    query_norm: str,
    faiss_index,
    bm25_index,
    docs: list[str],
    candidate_k: int,
    intent: str,
) -> list[tuple[float, str]]:
    """
    Hybrid search using FAISS (semantic) + BM25 (lexical).
    Returns list of (combined_score, doc) tuples, sorted by score descending.
    """
    results_by_doc: dict[str, tuple[float, str, float]] = {}  # doc_hash -> (rrf_score, doc, bm25_raw)

    # ─── FAISS search (semantic) ──────────────────────────────────────────────
    if faiss_index is not None and len(docs) > 0:
        k = min(candidate_k, faiss_index.ntotal)
        distances, indices = faiss_index.search(query_vec, k)
        faiss_candidates = []
        for rank, (dist, i) in enumerate(zip(distances[0], indices[0])):
            if 0 <= i < len(docs):
                score = float(dist)
                if score >= _MIN_SCORE:
                    doc = docs[i]
                    h = _hash_doc(doc)
                    rrf = _rrf_score(rank, k=60)
                    results_by_doc[h] = (rrf, doc, 0.0)  # 0.0 = no BM25 yet
                    faiss_candidates.append((rank, rrf, doc))
        logger.debug("FAISS candidates=%d for intent=%s", len(faiss_candidates), intent)

    # ─── BM25 search (lexical) ───────────────────────────────────────────────
    if bm25_index is not None and len(docs) > 0:
        tokenized = query_norm.lower().split()
        bm25_scores = bm25_index.get_scores(tokenized)
        # Get top-k indices by BM25 score
        top_bm25_indices = np.argsort(-bm25_scores)[:candidate_k]
        bm25_candidates = []
        for rank, i in enumerate(top_bm25_indices):
            if 0 <= i < len(docs):
                raw_score = float(bm25_scores[i])
                if raw_score > 0:
                    doc = docs[i]
                    h = _hash_doc(doc)
                    rrf = _rrf_score(rank, k=60)
                    if h in results_by_doc:
                        _, _, _ = results_by_doc[h]
                        results_by_doc[h] = (results_by_doc[h][0] + rrf, doc, raw_score)
                    else:
                        results_by_doc[h] = (rrf, doc, raw_score)
                    bm25_candidates.append((rank, rrf, doc))
        logger.debug("BM25 candidates=%d for intent=%s", len(bm25_candidates), intent)

    # ─── Merge results by RRF score ──────────────────────────────────────────
    merged = [(rrf, doc) for rrf, doc, _ in results_by_doc.values()]
    merged.sort(key=lambda x: x[0], reverse=True)

    return merged



def retrieve(query: str, top_k: int = 5, intent: str = "general") -> str:
    """
    Retrieve top_k most relevant chunks for `query` using hybrid (FAISS + BM25) search.
    
    Combines semantic search (FAISS) + lexical search (BM25) via reciprocal rank fusion.
    Returns a single string block (chunks separated by blank lines).
    """
    t0 = time.perf_counter()
    _ensure_loaded()
    model = _get_model()

    effective_top_k = max(1, int(top_k or _DEFAULT_TOP_K))
    query_norm = _normalize_query(query)
    cache_key = f"{intent}:{effective_top_k}:{query_norm}"

    # ─── Query cache lookup ──────────────────────────────────────────────────
    cached = _cache_get_query(cache_key)
    if cached is not None:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        logger.debug("RAG cache hit intent=%s top_k=%d query=%s latency_ms=%.2f", 
                     intent, effective_top_k, query_norm[:80], elapsed_ms)
        return cached

    # ─── Encode query (with embedding cache) ─────────────────────────────────
    vec_key = f"{intent}:{query_norm}"
    query_vec = _cache_get_embed(vec_key)
    if query_vec is None:
        query_vec = model.encode([query_norm], normalize_embeddings=True).astype("float32")
        _cache_set_embed(vec_key, query_vec)

    candidate_k = max(effective_top_k, effective_top_k * _CANDIDATE_MULTIPLIER)
    search_plan = _resolve_index_plan(intent, query_norm)

    all_results: list[tuple[float, str]] = []

    # Search the primary corpus first; only fall back to the secondary corpus
    # if the first pass is weak or empty.
    primary_name, primary_faiss, primary_bm25, primary_docs = search_plan[0]
    if primary_faiss is not None or primary_bm25 is not None:
        all_results = _hybrid_search(
            query_vec,
            query_norm,
            primary_faiss,
            primary_bm25,
            primary_docs,
            candidate_k,
            primary_name,
        )

    primary_best = _best_score(all_results)
    if not all_results or (len(all_results) < effective_top_k and primary_best < 0.28):
        secondary_name, secondary_faiss, secondary_bm25, secondary_docs = search_plan[1]
        if secondary_faiss is not None or secondary_bm25 is not None:
            fallback = _hybrid_search(
                query_vec,
                query_norm,
                secondary_faiss,
                secondary_bm25,
                secondary_docs,
                candidate_k,
                secondary_name,
            )
            all_results.extend(fallback)

    if not all_results:
        _cache_set_query(cache_key, "")
        return ""

    # ─── Merge & deduplicate across all results ──────────────────────────────
    all_results.sort(key=lambda x: x[0], reverse=True)
    
    unique: list[tuple[float, str]] = []
    seen = set()
    for score, doc in all_results:
        h = _hash_doc(doc)
        if h in seen:
            continue
        seen.add(h)
        unique.append((score, doc))
        if len(unique) >= effective_top_k:
            break

    top = unique[:effective_top_k]

    chunks = "\n\n".join(chunk for _, chunk in top)
    if len(chunks) > _MAX_CONTEXT_CHARS:
        chunks = chunks[:_MAX_CONTEXT_CHARS] + "…"

    _cache_set_query(cache_key, chunks)

    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    logger.debug(
        "RAG hybrid retrieve intent=%s top_k=%d candidates=%d selected=%d latency_ms=%.2f",
        intent,
        effective_top_k,
        len(all_results),
        len(top),
        elapsed_ms,
    )
    return chunks
