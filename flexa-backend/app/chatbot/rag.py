"""
rag.py — FAISS-backed semantic retrieval for FLEXOR.

At startup, loads two indexes:
  • fitness_qa   — from HuggingFace its-myrto/fitness-question-answers
  • nutrition     — from USDA / food.com summaries

Call `retrieve(query, top_k=5)` to get relevant text chunks.
"""
from __future__ import annotations
import os
import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Paths
_BASE = Path(__file__).resolve().parents[2] / "data" / "faiss"
_FITNESS_INDEX = _BASE / "fitness_qa.index"
_FITNESS_DOCS  = _BASE / "fitness_qa_docs.json"
_NUTRITION_INDEX = _BASE / "nutrition.index"
_NUTRITION_DOCS  = _BASE / "nutrition_docs.json"

# Lazy singletons
_model = None
_fitness_index = None
_fitness_docs: list[str] = []
_nutrition_index = None
_nutrition_docs: list[str] = []


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


def _ensure_loaded():
    global _fitness_index, _fitness_docs, _nutrition_index, _nutrition_docs
    if _fitness_index is None:
        _fitness_index, _fitness_docs = _load_index(_FITNESS_INDEX, _FITNESS_DOCS)
    if _nutrition_index is None:
        _nutrition_index, _nutrition_docs = _load_index(_NUTRITION_INDEX, _NUTRITION_DOCS)


def retrieve(query: str, top_k: int = 5, intent: str = "general") -> str:
    """
    Retrieve top_k most relevant chunks for `query`.
    Returns a single string block (chunks separated by blank lines).
    """
    _ensure_loaded()
    model = _get_model()

    query_vec = model.encode([query], normalize_embeddings=True).astype("float32")

    results: list[tuple[float, str]] = []

    # Pick primary index based on intent
    if intent in ("nutrition", "diet_plan", "recipe"):
        indexes = [(_nutrition_index, _nutrition_docs), (_fitness_index, _fitness_docs)]
    else:
        indexes = [(_fitness_index, _fitness_docs), (_nutrition_index, _nutrition_docs)]

    for idx, docs in indexes:
        if idx is None or len(docs) == 0:
            continue
        k = min(top_k, idx.ntotal)
        distances, indices = idx.search(query_vec, k)
        for dist, i in zip(distances[0], indices[0]):
            if 0 <= i < len(docs):
                results.append((float(dist), docs[i]))

    if not results:
        return ""

    # Sort by score descending (cosine similarity, higher = better)
    results.sort(key=lambda x: x[0], reverse=True)
    top = results[:top_k]

    chunks = "\n\n".join(chunk for _, chunk in top)
    # Truncate to ~600 tokens (rough: 4 chars per token)
    if len(chunks) > 2400:
        chunks = chunks[:2400] + "…"
    return chunks
