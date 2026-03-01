"""
Script: seed_nutrition_db.py
Seed PostgreSQL nutrition_foods table from:
  1. data/usda_clean.csv        (USDA, capped at 5000 rows)
  2. Datasets/pakistani_meals.csv (custom Pakistani meals)

Features:
  - Idempotent: clears and reseeds the table each run
  - Maps Pakistani CSV allergen format → space-separated
  - Infers meal_type from Pakistani CSV correctly

Usage:
  python scripts/seed_nutrition_db.py

Requires:
  DATABASE_URL env var or default in core/config.py
"""
import os
import sys
import asyncio
import pandas as pd

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text, delete
from app.core.config import settings
from app.models.diet import NutritionFood, Base

USDA_CLEAN   = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "usda_clean.csv"))
FOODCOM_CLEAN = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "foodcom_clean.csv"))
PAK_MEALS    = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Datasets", "pakistani_meals.csv"))
USDA_LIMIT   = 5000   # keep DB manageable
FOODCOM_LIMIT = 3000  # Food.com supplement


engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed():
    print("[INFO] Creating tables …")
    await create_tables()

    rows = []

    # ── 1. USDA ────────────────────────────────────────────────────────────
    if os.path.exists(USDA_CLEAN):
        df = pd.read_csv(USDA_CLEAN).head(USDA_LIMIT)
        df = df.fillna(0)
        for _, r in df.iterrows():
            rows.append(NutritionFood(
                food_name    = str(r.get("food_name", "")).strip()[:500],
                calories     = float(r.get("calories",  0)),
                protein_g    = float(r.get("protein_g", 0)),
                carbs_g      = float(r.get("carbs_g",   0)),
                fat_g        = float(r.get("fat_g",     0)),
                fiber_g      = float(r.get("fiber_g",   0)),
                serving_size_g = float(r.get("serving_size_g", 100)),
                meal_type    = str(r.get("meal_type", "any")),
                cuisine      = str(r.get("cuisine",   "general")),
                diet_type    = str(r.get("diet_type", "non-vegetarian")),
                allergens    = str(r.get("allergens",  "")),
                ingredients  = str(r.get("ingredients",""))[:2000],
                region       = str(r.get("region",    "general")),
                source       = "usda",
            ))
        print(f"[INFO] Loaded {len(rows)} USDA rows.")
    else:
        print(f"[WARN] USDA clean file not found: {USDA_CLEAN}")
        print("       Run: python scripts/preprocess_usda.py first.")

    # ── 2. Food.com Recipes ────────────────────────────────────────────────
    if os.path.exists(FOODCOM_CLEAN):
        fc = pd.read_csv(FOODCOM_CLEAN).head(FOODCOM_LIMIT).fillna(0)
        before = len(rows)
        for _, r in fc.iterrows():
            rows.append(NutritionFood(
                food_name    = str(r.get("food_name", "")).strip()[:500],
                calories     = float(r.get("calories",  0)),
                protein_g    = float(r.get("protein_g", 0)),
                carbs_g      = float(r.get("carbs_g",   0)),
                fat_g        = float(r.get("fat_g",     0)),
                fiber_g      = float(r.get("fiber_g",   0)),
                serving_size_g = float(r.get("serving_size_g", 200)),
                meal_type    = str(r.get("meal_type", "any")),
                cuisine      = str(r.get("cuisine",   "general")),
                diet_type    = str(r.get("diet_type", "non-vegetarian")),
                allergens    = str(r.get("allergens",  "")),
                ingredients  = str(r.get("ingredients",""))[:2000],
                region       = str(r.get("region",    "general")),
                source       = "foodcom",
            ))
        print(f"[INFO] Loaded {len(rows) - before} Food.com rows.")
    else:
        print(f"[INFO] Food.com clean file not found (optional). Run preprocess_foodcom.py to include it.")

    # ── 3. Pakistani Meals ─────────────────────────────────────────────────
    if os.path.exists(PAK_MEALS):
        pak = pd.read_csv(PAK_MEALS).fillna("")

        # Map column names (the CSV already has standard names from our generator)
        for _, r in pak.iterrows():
            meal_type_raw = str(r.get("meal_type", "any")).strip().lower()
            meal_type = meal_type_raw if meal_type_raw in ["breakfast","lunch","dinner","snack"] else "any"

            diet_raw = str(r.get("diet_type", "non-vegetarian")).strip().lower()
            diet_map = {"non-vegetarian": "non-vegetarian", "vegetarian": "vegetarian", "vegan": "vegan"}
            diet_type = diet_map.get(diet_raw, "non-vegetarian")

            allergen_raw = str(r.get("allergens", ""))
            allergens = allergen_raw.replace("|", " ").lower().strip()

            cuisine  = str(r.get("cuisine", "general")).strip().lower()
            region   = cuisine  # cuisine IS the region for Pakistani meals

            rows.append(NutritionFood(
                food_name    = str(r.get("meal_name", "")).strip()[:500],
                calories     = float(r.get("calories",  0)),
                protein_g    = float(r.get("protein_g", 0)),
                carbs_g      = float(r.get("carbs_g",   0)),
                fat_g        = float(r.get("fat_g",     0)),
                fiber_g      = 0.0,
                serving_size_g = 250.0,  # typical Pakistani serving
                meal_type    = meal_type,
                cuisine      = cuisine,
                diet_type    = diet_type,
                allergens    = allergens,
                ingredients  = str(r.get("ingredients", ""))[:2000],
                region       = region,
                source       = "custom",
            ))
        print(f"[INFO] Loaded {len(pak)} Pakistani meal rows.")
    else:
        print(f"[WARN] Pakistani meals CSV not found: {PAK_MEALS}")

    # ── 4. Write to DB ─────────────────────────────────────────────────────
    print(f"[INFO] Seeding {len(rows)} total rows …")
    async with SessionLocal() as db:
        # Clear existing data
        await db.execute(delete(NutritionFood))
        await db.commit()

        # Bulk insert in chunks
        CHUNK = 500
        for i in range(0, len(rows), CHUNK):
            db.add_all(rows[i:i+CHUNK])
            await db.commit()
            print(f"  → Inserted rows {i}–{min(i+CHUNK, len(rows))}")

    print(f"[✅] Nutrition DB seeded with {len(rows)} items.")


if __name__ == "__main__":
    asyncio.run(seed())
