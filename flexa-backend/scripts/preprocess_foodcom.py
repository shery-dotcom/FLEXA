"""
Script: preprocess_foodcom.py
Food.com Recipes Dataset → nutrition_foods table

Reads:
  - RAW_recipes.csv    (id, name, minutes, contributor_id, submitted,
                        tags, nutrition, n_steps, steps, description,
                        ingredients, n_ingredients)

  nutrition column is a JSON-like list:
    [calories, total_fat_%DV, sugar_%DV, sodium_%DV,
     protein_%DV, saturated_fat_%DV, carbohydrates_%DV]

We convert %DV → grams using FDA reference values:
  total_fat     reference: 78g   → grams = (%DV / 100) * 78
  protein       reference: 50g   → grams = (%DV / 100) * 50
  carbohydrates reference: 275g  → grams = (%DV / 100) * 275
  (calories are already in kcal per serving)

Normalization to per-100g:
  We assume a standard serving size of 200g (typical recipe portion).
  scale = 100 / 200 = 0.5

Region tagging:
  Keyword-based heuristic on tags/name to assign a region.
  Pakistani/South Asian dishes get 'general' or more specific tags.

Output: data/foodcom_clean.csv

Usage:
  python scripts/preprocess_foodcom.py
"""
import os
import sys
import ast
import pandas as pd

DATASET_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Datasets", "Food.com")
)
OUT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "foodcom_clean.csv")
)

# FDA %DV reference amounts (grams)
FAT_REF     = 78.0
PROTEIN_REF = 50.0
CARB_REF    = 275.0
ASSUMED_SERVING_G = 200.0

# Max rows to keep (for DB manageability)
MAX_ROWS = 8000

# Meal type keyword inference
BREAKFAST_KW = {"breakfast", "morning", "pancake", "waffle", "oatmeal", "egg", "omelette"}
LUNCH_KW     = {"lunch", "sandwich", "salad", "soup", "wrap"}
DINNER_KW    = {"dinner", "supper", "roast", "stew", "curry", "biryani", "grilled"}
SNACK_KW     = {"snack", "dessert", "cookie", "cake", "muffin", "donut", "bar", "smoothie"}

# Region keyword inference
REGION_MAP = {
    "punjabi":  ["punjabi", "sarson", "makki"],
    "sindhi":   ["sindhi"],
    "kashmiri": ["kashmiri", "rogan josh", "yakhni"],
    "balochi":  ["balochi", "sajji"],
    "pashtun":  ["pashtun", "peshwari", "karahi"],
    "mexican":  ["mexican", "taco", "burrito", "salsa"],
    "italian":  ["italian", "pasta", "pizza", "risotto"],
    "chinese":  ["chinese", "stir fry", "dim sum", "noodle"],
    "indian":   ["indian", "masala", "tikka", "paneer", "dal"],
    "american": ["american", "burger", "bbq", "grilled cheese"],
}

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)


def infer_meal_type(tags_str: str, name: str) -> str:
    combined = (tags_str + " " + name).lower()
    for kw in BREAKFAST_KW:
        if kw in combined: return "breakfast"
    for kw in LUNCH_KW:
        if kw in combined: return "lunch"
    for kw in DINNER_KW:
        if kw in combined: return "dinner"
    for kw in SNACK_KW:
        if kw in combined: return "snack"
    return "any"


def infer_region(tags_str: str, name: str) -> str:
    combined = (tags_str + " " + name).lower()
    for region, keywords in REGION_MAP.items():
        if any(kw in combined for kw in keywords):
            return region
    return "general"


def infer_diet_type(tags_str: str, ingredients_str: str) -> str:
    combined = (tags_str + " " + ingredients_str).lower()
    meat_kw = {"chicken", "beef", "pork", "lamb", "fish", "prawn", "shrimp",
               "turkey", "bacon", "meat", "seafood", "tuna", "salmon"}
    vegan_kw = {"vegan", "plant-based"}
    veg_kw   = {"vegetarian"}

    if any(kw in combined for kw in vegan_kw):
        return "vegan"
    if any(kw in combined for kw in veg_kw):
        if not any(kw in combined for kw in meat_kw):
            return "vegetarian"
    return "non-vegetarian"


def parse_nutrition(val) -> dict:
    """Parse Food.com nutrition list into macro dict."""
    try:
        nums = ast.literal_eval(str(val))
        if len(nums) < 7:
            return {}
        calories  = float(nums[0])
        fat_g     = (float(nums[1]) / 100) * FAT_REF
        protein_g = (float(nums[4]) / 100) * PROTEIN_REF
        carbs_g   = (float(nums[6]) / 100) * CARB_REF
        return {"calories": calories, "fat_g": fat_g, "protein_g": protein_g, "carbs_g": carbs_g}
    except Exception:
        return {}


def main():
    raw_path = os.path.join(DATASET_DIR, "RAW_recipes.csv")
    if not os.path.exists(raw_path):
        print(f"[ERROR] RAW_recipes.csv not found at: {raw_path}")
        sys.exit(1)

    print(f"[INFO] Loading RAW_recipes.csv …")
    df = pd.read_csv(raw_path, low_memory=False)
    print(f"[INFO] Loaded {len(df)} rows.")

    # Parse nutrition
    nutrition_rows = df["nutrition"].apply(parse_nutrition)
    nutrition_df   = pd.DataFrame(list(nutrition_rows))
    df = pd.concat([df, nutrition_df], axis=1)

    # Drop rows with missing calories
    df.dropna(subset=["calories"], inplace=True)
    df = df[df["calories"] > 0]

    # Clip unrealistic macros
    df["calories"]  = df["calories"].clip(0, 2000)
    df["protein_g"] = df["protein_g"].fillna(0).clip(0, 200)
    df["carbs_g"]   = df["carbs_g"].fillna(0).clip(0, 300)
    df["fat_g"]     = df["fat_g"].fillna(0).clip(0, 150)

    # Normalize to per 100g
    scale = 100.0 / ASSUMED_SERVING_G
    df["calories"]  = (df["calories"]  * scale).round(1)
    df["protein_g"] = (df["protein_g"] * scale).round(1)
    df["carbs_g"]   = (df["carbs_g"]   * scale).round(1)
    df["fat_g"]     = (df["fat_g"]     * scale).round(1)

    # Infer metadata
    df["tags_str"] = df["tags"].fillna("").astype(str)
    df["meal_type"] = df.apply(lambda r: infer_meal_type(r["tags_str"], str(r["name"])), axis=1)
    df["region"]    = df.apply(lambda r: infer_region(r["tags_str"], str(r["name"])), axis=1)
    df["diet_type"] = df.apply(
        lambda r: infer_diet_type(r["tags_str"], str(r.get("ingredients", ""))), axis=1
    )

    # Build output
    output = pd.DataFrame({
        "food_name":      df["name"].fillna("Unknown").str.strip().str[:500],
        "calories":       df["calories"],
        "protein_g":      df["protein_g"],
        "carbs_g":        df["carbs_g"],
        "fat_g":          df["fat_g"],
        "fiber_g":        0.0,
        "serving_size_g": ASSUMED_SERVING_G,
        "meal_type":      df["meal_type"],
        "cuisine":        df["region"],
        "diet_type":      df["diet_type"],
        "allergens":      "",
        "ingredients":    df["ingredients"].fillna("").astype(str).str[:2000],
        "region":         df["region"],
        "source":         "foodcom",
    })

    output.drop_duplicates(subset=["food_name"], inplace=True)
    output = output.head(MAX_ROWS)

    output.to_csv(OUT_PATH, index=False)
    print(f"[✅] Saved {len(output)} Food.com recipes → {OUT_PATH}")


if __name__ == "__main__":
    main()
