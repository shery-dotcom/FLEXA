"""
build_rag_index.py — Build FAISS indexes for FLEXOR RAG.

Run once (or when data changes):
    python scripts/build_rag_index.py

Outputs:
    flexa-backend/data/faiss/fitness_qa.index
    flexa-backend/data/faiss/fitness_qa_docs.json
    flexa-backend/data/faiss/nutrition.index
    flexa-backend/data/faiss/nutrition_docs.json

Sources:
    1. HuggingFace: its-myrto/fitness-question-answers
    2. Datasets/pakistani_meals.csv
    3. Datasets/Food.com/RAW_recipes.csv (sample)
"""
import os
import sys
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[1]           # flexa-backend/
DATA_DIR = ROOT / "data" / "faiss"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATASETS_DIR = ROOT.parent / "Datasets"              # Datasets/
PAKISTANI_CSV = DATASETS_DIR / "pakistani_meals.csv"
FOODCOM_CSV = DATASETS_DIR / "Food.com" / "RAW_recipes.csv"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def chunk_text(text: str, max_chars: int = 400) -> list[str]:
    """Split text into overlapping chunks of ~max_chars."""
    words = text.split()
    chunks: list[str] = []
    buf: list[str] = []
    length = 0
    for word in words:
        buf.append(word)
        length += len(word) + 1
        if length >= max_chars:
            chunks.append(" ".join(buf))
            # overlap: keep last 20 words
            buf = buf[-20:]
            length = sum(len(w) + 1 for w in buf)
    if buf:
        chunks.append(" ".join(buf))
    return chunks


def embed_and_save(docs: list[str], index_path: Path, docs_path: Path, model) -> None:
    """Embed docs with sentence-transformers → save FAISS index + doc list."""
    import faiss

    if not docs:
        logger.warning(f"No docs to embed for {index_path.name}")
        return

    logger.info(f"Embedding {len(docs)} chunks → {index_path.name}")
    batch_size = 128
    all_vecs = []
    for i in range(0, len(docs), batch_size):
        batch = docs[i:i + batch_size]
        vecs = model.encode(batch, normalize_embeddings=True, show_progress_bar=False)
        all_vecs.append(vecs)
        if i % (batch_size * 10) == 0 and i > 0:
            logger.info(f"  ... {i}/{len(docs)}")

    vectors = np.vstack(all_vecs).astype("float32")
    dim = vectors.shape[1]

    index = faiss.IndexFlatIP(dim)  # inner product on normalized = cosine similarity
    index.add(vectors)
    faiss.write_index(index, str(index_path))

    with open(docs_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False)

    logger.info(f"Saved index ({index.ntotal} vectors) → {index_path}")


# ─── Source 1: HuggingFace Fitness Q&A ───────────────────────────────────────

def load_fitness_qa() -> list[str]:
    """Download its-myrto/fitness-question-answers and format as Q+A chunks."""
    logger.info("Loading HuggingFace dataset: its-myrto/fitness-question-answers")
    try:
        from datasets import load_dataset
        ds = load_dataset("its-myrto/fitness-question-answers", split="train")
        docs = []
        for item in ds:
            q = str(item.get("question") or item.get("Question") or "").strip()
            a = str(item.get("answer") or item.get("Answer") or "").strip()
            if q and a:
                combined = f"Q: {q}\nA: {a}"
                docs.extend(chunk_text(combined, max_chars=350))
        logger.info(f"Fitness Q&A: {len(docs)} chunks from {len(ds)} items")
        return docs
    except Exception as e:
        logger.error(f"Failed to load HuggingFace dataset: {e}")
        return []


# ─── Source 2: Pakistani meals CSV ───────────────────────────────────────────

def load_pakistani_meals() -> list[str]:
    if not PAKISTANI_CSV.exists():
        logger.warning(f"Pakistani meals CSV not found at {PAKISTANI_CSV}")
        return []
    try:
        df = pd.read_csv(PAKISTANI_CSV)
        docs = []
        for _, row in df.iterrows():
            parts = []
            for col in df.columns:
                val = str(row[col]).strip()
                if val and val.lower() not in ("nan", "none", "0.0", "0"):
                    parts.append(f"{col}: {val}")
            if parts:
                text = " | ".join(parts)
                docs.extend(chunk_text(text, max_chars=300))
        logger.info(f"Pakistani meals: {len(docs)} chunks")
        return docs
    except Exception as e:
        logger.error(f"Failed to load Pakistani meals CSV: {e}")
        return []


# ─── Source 3: Food.com recipes (sampled) ────────────────────────────────────

def load_foodcom_recipes(max_rows: int = 5000) -> list[str]:
    if not FOODCOM_CSV.exists():
        logger.warning(f"Food.com recipes CSV not found at {FOODCOM_CSV}")
        return []
    try:
        df = pd.read_csv(FOODCOM_CSV, nrows=max_rows, usecols=lambda c: c in (
            "name", "description", "ingredients", "tags", "nutrition", "steps"
        ))
        docs = []
        for _, row in df.iterrows():
            name = str(row.get("name", "")).strip()
            desc = str(row.get("description", "")).strip()
            ingr = str(row.get("ingredients", "")).strip()
            if name and (desc or ingr):
                text = f"Recipe: {name}. {desc} Ingredients: {ingr}"
                docs.extend(chunk_text(text, max_chars=350))
        logger.info(f"Food.com recipes: {len(docs)} chunks")
        return docs
    except Exception as e:
        logger.error(f"Failed to load Food.com recipes: {e}")
        return []


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    logger.info("Loading sentence-transformer model: all-MiniLM-L6-v2")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2")

    # ── Fitness index ──────────────────────────────────────────────────────────
    fitness_docs = load_fitness_qa()
    if not fitness_docs:
        logger.warning("No fitness docs — creating minimal placeholder.")
        fitness_docs = [
            "Regular exercise improves cardiovascular health and mental wellbeing.",
            "Strength training builds muscle, increases metabolism, and strengthens bones.",
            "A balanced diet with adequate protein supports muscle recovery after workouts.",
            "Progressive overload — gradually increasing weight or reps — is key to muscle growth.",
            "Rest days are essential for muscle repair and preventing overtraining.",
        ]

    embed_and_save(
        fitness_docs,
        DATA_DIR / "fitness_qa.index",
        DATA_DIR / "fitness_qa_docs.json",
        model,
    )

    # ── Nutrition index ────────────────────────────────────────────────────────
    nutrition_docs = (
        load_pakistani_meals() +
        load_foodcom_recipes(max_rows=5000)
    )
    if not nutrition_docs:
        logger.warning("No nutrition docs — creating minimal placeholder.")
        nutrition_docs = [
            "Dal (lentils) is a high-protein, low-fat food staple in Pakistani cuisine.",
            "Roti is a whole-wheat flatbread with around 70 calories per piece.",
            "Biryani is a rice dish with spices, typically 500-700 calories per serving.",
            "Chicken tikka (grilled) provides ~200 calories per 100g with high protein.",
        ]

    embed_and_save(
        nutrition_docs,
        DATA_DIR / "nutrition.index",
        DATA_DIR / "nutrition_docs.json",
        model,
    )

    logger.info("✅ RAG indexes built successfully.")
    logger.info(f"   → {DATA_DIR}/fitness_qa.index")
    logger.info(f"   → {DATA_DIR}/nutrition.index")


if __name__ == "__main__":
    # Add flexa-backend to sys.path so imports work
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    main()
