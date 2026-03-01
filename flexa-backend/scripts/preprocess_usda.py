"""
Script: preprocess_usda.py
USDA FoodData Central → nutrition_foods table

Reads:
  - food.csv           (fdc_id, description, food_category_id)
  - food_nutrient.csv  (fdc_id, nutrient_id, amount)
  - nutrient.csv       (id, name, unit_name)
  - food_portion.csv   (fdc_id, gram_weight)

USDA nutrient IDs used:
  1008 → Energy (kcal)
  1003 → Protein (g)
  1005 → Carbohydrates (g)
  1004 → Total lipid/fat (g)
  1079 → Fiber (g)

Output: data/usda_clean.csv  (all values per 100g)

Usage:
  python scripts/preprocess_usda.py
"""
import os
import sys
import pandas as pd
import numpy as np

DATASET_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Datasets", "FoodData_Central_csv_2025-12-18")
)
OUT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "usda_clean.csv")
)

NUTRIENT_IDS = {
    1008: "calories",
    1003: "protein_g",
    1005: "carbs_g",
    1004: "fat_g",
    1079: "fiber_g",
}

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)


def load_csv(name: str, **kwargs) -> pd.DataFrame:
    path = os.path.join(DATASET_DIR, name)
    if not os.path.exists(path):
        print(f"[WARN] Missing dataset file: {path}")
        return pd.DataFrame()
    print(f"[INFO] Loading {name} …")
    return pd.read_csv(path, low_memory=False, **kwargs)


def main():
    food_df     = load_csv("food.csv")
    nutrient_df = load_csv("food_nutrient.csv")
    nutrient_meta = load_csv("nutrient.csv")

    if food_df.empty or nutrient_df.empty:
        print("[ERROR] Required USDA files missing. Aborting.")
        sys.exit(1)

    # Keep only the 5 target nutrients
    target_ids = list(NUTRIENT_IDS.keys())
    fn = nutrient_df[nutrient_df["nutrient_id"].isin(target_ids)].copy()
    fn["nutrient_name"] = fn["nutrient_id"].map(NUTRIENT_IDS)

    # Pivot: one row per food, one column per nutrient
    pivoted = fn.pivot_table(index="fdc_id", columns="nutrient_name", values="amount", aggfunc="mean").reset_index()

    # Merge with food names
    merged = food_df[["fdc_id", "description"]].merge(pivoted, on="fdc_id", how="inner")
    merged.rename(columns={"description": "food_name"}, inplace=True)

    # Drop rows with no calorie data
    merged.dropna(subset=["calories"], inplace=True)

    # Clip unrealistic values
    merged["calories"]   = merged["calories"].clip(0, 900)
    merged["protein_g"]  = merged["protein_g"].fillna(0).clip(0, 100)
    merged["carbs_g"]    = merged["carbs_g"].fillna(0).clip(0, 100)
    merged["fat_g"]      = merged["fat_g"].fillna(0).clip(0, 100)
    merged["fiber_g"]    = merged["fiber_g"].fillna(0).clip(0, 50)

    # Add defaults for extra columns needed by nutrition_foods table
    merged["serving_size_g"] = 100.0
    merged["meal_type"]      = "any"
    merged["cuisine"]        = "general"
    merged["diet_type"]      = "non-vegetarian"
    merged["allergens"]      = ""
    merged["ingredients"]    = ""
    merged["region"]         = "general"
    merged["source"]         = "usda"

    # Keep only needed columns
    cols = [
        "food_name", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g",
        "serving_size_g", "meal_type", "cuisine", "diet_type",
        "allergens", "ingredients", "region", "source"
    ]
    output = merged[[c for c in cols if c in merged.columns]].drop_duplicates(subset=["food_name"])

    output.to_csv(OUT_PATH, index=False)
    print(f"[✅] Saved {len(output)} USDA food items → {OUT_PATH}")


if __name__ == "__main__":
    main()
