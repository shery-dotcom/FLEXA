"""
Module 3 – Meal Recommendation Engine
Strategy: ML-powered content-based filtering.
  1. StandardScaler normalises the 5-dimensional macro feature space
     [calories, protein_g, carbs_g, fat_g, fiber_g] across all 8 000+ foods.
  2. Cosine similarity ranks candidates against the user's per-slot macro
     target so the full macro PROFILE is matched, not just total calories.
  3. A soft region boost (+0.15) surfaces culturally relevant meals.
  4. Hard filters (meal_type / diet_type / allergens) are applied first so
     ML scoring only runs on valid candidates.
  5. Stochastic tie-breaking (random.choice over top-5) ensures variety
     across plan regenerations.
Fallback: built-in food library used when the DB is empty.
"""
import re
import ast
import random
import logging
from types import SimpleNamespace
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.diet import NutritionFood
from app.schemas.diet import MealSuggestion, DietPlanResponse
from app.ml.meal_recommender_ml import get_recommender

logger = logging.getLogger(__name__)

# ── Food name / ingredient / allergen cleaning ─────────────────────────────
_LEADING_NUM_RE   = re.compile(r"^\d[\d\s\-]*\b\s*")
_FILLER_PREFIX_RE = re.compile(
    r"^(?:"
    r"a\s+(?:new\s+|great\s+|easy\s+|quick\s+|can\s+of[\s\w]+?(?:and|&)[\s\w]+?\s+)?"
    r"|crazy\s+easy\s+|super\s+easy\s+|super\s+quick\s+|quick\s+and\s+easy\s+"
    r"|easy\s+|simple\s+|world's\s+(?:best\s+|easiest\s+)?"
    r")",
    re.IGNORECASE,
)
_JUNK_SUFFIX_RE  = re.compile(
    r"\s+\(?\s*(?:ver(?:sion)?\s*[.\d]+|#\d+|recipe)\s*\)?$",
    re.IGNORECASE,
)
_MULTI_SPACE_RE  = re.compile(r"\s{2,}")


def _clean_food_name(name: str) -> str:
    """Normalize a raw recipe/food name into a presentable title."""
    if not name:
        return name
    name = str(name).strip()
    name = _LEADING_NUM_RE.sub("", name).strip()
    for _ in range(2):  # apply twice for nested matches
        name = _FILLER_PREFIX_RE.sub("", name).strip()
    name = _JUNK_SUFFIX_RE.sub("", name).strip()
    name = _MULTI_SPACE_RE.sub(" ", name)
    name = name.title()
    if len(name) > 60:
        name = name[:57].rstrip() + "\u2026"
    return name or "Unknown Food"


def _clean_ingredients(raw: str) -> str:
    """Convert Python list-repr ingredients string to a clean comma-separated list."""
    if not raw or str(raw).strip() in ("0.0", "0", "nan", "None", ""):
        return ""
    raw = str(raw).strip()
    if raw.startswith("[") and raw.endswith("]"):
        try:
            items = ast.literal_eval(raw)
            if isinstance(items, list):
                cleaned = [
                    str(i).strip().title()
                    for i in items
                    if i and str(i).strip() not in ("nan", "0.0", "0", "None", "")
                ]
                return ", ".join(cleaned)
        except (ValueError, SyntaxError):
            raw = raw[1:-1].replace("'", "").replace('"', "").strip()
    return raw


def _clean_allergens(raw: str) -> str:
    """Return empty string for garbage allergen values ('0.0', 'nan', etc.)."""
    if not raw or str(raw).strip() in ("0.0", "0", "nan", "None", ""):
        return ""
    return str(raw).strip()


# Tips library
DIET_TIPS = [
    "Drink at least 8 glasses of water daily.",
    "Eat slowly and chew thoroughly to aid digestion.",
    "Front-load calories — eat larger meals earlier in the day.",
    "Add green vegetables to every meal for micronutrients.",
    "Avoid processed sugar; opt for natural sweeteners like dates.",
    "Protein at each meal helps maintain satiety and muscle mass.",
    "Do not skip breakfast — it kick-starts your metabolism.",
    "Sleep 7–8 hours; poor sleep increases hunger hormones.",
    "Plan your meals the night before to avoid impulsive choices.",
    "Track consistency over perfection — 80/20 rule works.",
]

# Meal slot distribution as ordered list of (category, calorie_fraction)
# "snack" entries are all collected into the snacks[] array.
MEAL_CALORIE_SPLITS = {
    2: [("lunch", 0.50), ("dinner", 0.50)],
    3: [("breakfast", 0.30), ("lunch", 0.40), ("dinner", 0.30)],
    4: [("breakfast", 0.25), ("lunch", 0.35), ("dinner", 0.30), ("snack", 0.10)],
    5: [("breakfast", 0.25), ("snack", 0.10), ("lunch", 0.30), ("dinner", 0.25), ("snack", 0.10)],
    6: [("breakfast", 0.20), ("snack", 0.10), ("lunch", 0.25), ("snack", 0.10), ("dinner", 0.25), ("snack", 0.10)],
}

SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack"]

# ─────────────────────────────────────────────────────────────────────────────
# Built-in food library — used when the DB is empty.
# Fields per entry: food_name, calories per 100g, protein_g, carbs_g, fat_g,
#                   meal_type, diet_type, region, allergens, ingredients
# ─────────────────────────────────────────────────────────────────────────────
BUILTIN_FOODS = [
    # ── Breakfast ────────────────────────────────────────────────────────────
    dict(food_name="Egg Omelette with Vegetables", calories=155, protein_g=11, carbs_g=3, fat_g=11,
         meal_type="breakfast", diet_type="non-vegetarian", region="general", allergens="eggs",
         ingredients="eggs, bell pepper, onion, olive oil, salt"),
    dict(food_name="Paratha with Yogurt", calories=280, protein_g=7, carbs_g=38, fat_g=12,
         meal_type="breakfast", diet_type="vegetarian", region="pakistani", allergens="gluten,dairy",
         ingredients="whole wheat flour, ghee, yogurt"),
    dict(food_name="Aloo Paratha", calories=260, protein_g=6, carbs_g=40, fat_g=10,
         meal_type="breakfast", diet_type="vegetarian", region="pakistani", allergens="gluten",
         ingredients="whole wheat flour, potato, cumin, green chilli, ghee"),
    dict(food_name="Halwa Puri", calories=400, protein_g=8, carbs_g=52, fat_g=18,
         meal_type="breakfast", diet_type="vegetarian", region="pakistani", allergens="gluten",
         ingredients="semolina, sugar, puri dough, ghee, chickpeas"),
    dict(food_name="Boiled Eggs with Toast", calories=200, protein_g=14, carbs_g=18, fat_g=7,
         meal_type="breakfast", diet_type="non-vegetarian", region="general", allergens="eggs,gluten",
         ingredients="eggs, whole wheat bread, butter"),
    dict(food_name="Greek Yogurt with Honey", calories=130, protein_g=10, carbs_g=16, fat_g=2,
         meal_type="breakfast", diet_type="vegetarian", region="general", allergens="dairy",
         ingredients="greek yogurt, honey, walnuts"),
    dict(food_name="Oatmeal with Banana", calories=180, protein_g=5, carbs_g=34, fat_g=3,
         meal_type="breakfast", diet_type="vegan", region="general", allergens="",
         ingredients="rolled oats, banana, almond milk, chia seeds"),
    dict(food_name="Chana Chaat", calories=210, protein_g=12, carbs_g=30, fat_g=4,
         meal_type="breakfast", diet_type="vegan", region="pakistani", allergens="",
         ingredients="chickpeas, tomato, onion, green chilli, tamarind chutney, chaat masala"),
    dict(food_name="Scrambled Eggs with Cheese", calories=220, protein_g=15, carbs_g=2, fat_g=17,
         meal_type="breakfast", diet_type="non-vegetarian", region="general", allergens="eggs,dairy",
         ingredients="eggs, cheddar cheese, butter, salt, pepper"),
    dict(food_name="Fruit Salad with Nuts", calories=160, protein_g=4, carbs_g=26, fat_g=6,
         meal_type="breakfast", diet_type="vegan", region="general", allergens="nuts",
         ingredients="apple, banana, pomegranate, almonds, walnuts"),

    # ── Lunch ────────────────────────────────────────────────────────────────
    dict(food_name="Chicken Biryani", calories=350, protein_g=22, carbs_g=45, fat_g=9,
         meal_type="lunch", diet_type="non-vegetarian", region="pakistani", allergens="",
         ingredients="basmati rice, chicken, yogurt, whole spices, saffron, onion, ghee"),
    dict(food_name="Daal Chawal (Lentil Rice)", calories=310, protein_g=14, carbs_g=52, fat_g=5,
         meal_type="lunch", diet_type="vegan", region="pakistani", allergens="",
         ingredients="red lentils, basmati rice, cumin, garlic, tomato, turmeric"),
    dict(food_name="Grilled Chicken Salad", calories=280, protein_g=32, carbs_g=10, fat_g=12,
         meal_type="lunch", diet_type="non-vegetarian", region="general", allergens="",
         ingredients="grilled chicken breast, lettuce, tomato, cucumber, olive oil, lemon"),
    dict(food_name="Beef Karahi", calories=380, protein_g=28, carbs_g=8, fat_g=26,
         meal_type="lunch", diet_type="non-vegetarian", region="pakistani", allergens="",
         ingredients="beef, tomatoes, green chilli, ginger, garlic, oil, coriander"),
    dict(food_name="Palak Paneer", calories=240, protein_g=14, carbs_g=12, fat_g=16,
         meal_type="lunch", diet_type="vegetarian", region="pakistani", allergens="dairy",
         ingredients="spinach, paneer, cream, garlic, ginger, cumin, garam masala"),
    dict(food_name="Vegetable Fried Rice", calories=290, protein_g=7, carbs_g=52, fat_g=6,
         meal_type="lunch", diet_type="vegan", region="general", allergens="",
         ingredients="basmati rice, carrot, peas, spring onion, soy sauce, sesame oil"),
    dict(food_name="Mutton Pulao", calories=420, protein_g=24, carbs_g=48, fat_g=14,
         meal_type="lunch", diet_type="non-vegetarian", region="pakistani", allergens="",
         ingredients="mutton, basmati rice, whole spices, yogurt, onion, stock"),
    dict(food_name="Tuna Wrap", calories=320, protein_g=28, carbs_g=30, fat_g=8,
         meal_type="lunch", diet_type="non-vegetarian", region="general", allergens="gluten,fish",
         ingredients="tuna, whole wheat wrap, lettuce, tomato, cucumber, mayo"),
    dict(food_name="Chickpea Curry (Chana Masala)", calories=260, protein_g=12, carbs_g=38, fat_g=7,
         meal_type="lunch", diet_type="vegan", region="pakistani", allergens="",
         ingredients="chickpeas, tomatoes, onion, garlic, ginger, spices, oil"),
    dict(food_name="Chicken Shawarma Bowl", calories=400, protein_g=30, carbs_g=35, fat_g=14,
         meal_type="lunch", diet_type="non-vegetarian", region="general", allergens="gluten",
         ingredients="chicken, garlic sauce, pita bread, lettuce, tomato, pickles"),

    # ── Dinner ───────────────────────────────────────────────────────────────
    dict(food_name="Baked Salmon with Steamed Vegetables", calories=360, protein_g=38, carbs_g=12, fat_g=18,
         meal_type="dinner", diet_type="non-vegetarian", region="general", allergens="fish",
         ingredients="salmon fillet, broccoli, carrot, olive oil, lemon, garlic, herbs"),
    dict(food_name="Chicken Qorma", calories=340, protein_g=26, carbs_g=10, fat_g=22,
         meal_type="dinner", diet_type="non-vegetarian", region="pakistani", allergens="dairy,nuts",
         ingredients="chicken, yogurt, fried onion, almonds, cream, whole spices, oil"),
    dict(food_name="Grilled Beef Steak with Salad", calories=420, protein_g=40, carbs_g=6, fat_g=26,
         meal_type="dinner", diet_type="non-vegetarian", region="general", allergens="",
         ingredients="beef steak, mixed greens, olive oil, black pepper, garlic, rosemary"),
    dict(food_name="Vegetable Stir Fry with Tofu", calories=230, protein_g=14, carbs_g=20, fat_g=10,
         meal_type="dinner", diet_type="vegan", region="general", allergens="soy",
         ingredients="tofu, broccoli, bell pepper, carrot, soy sauce, garlic, sesame oil"),
    dict(food_name="Nihari", calories=390, protein_g=30, carbs_g=14, fat_g=24,
         meal_type="dinner", diet_type="non-vegetarian", region="pakistani", allergens="gluten",
         ingredients="beef shank, wheat flour, whole spices, ginger, garlic, ghee, fried onion"),
    dict(food_name="Prawn Masala", calories=280, protein_g=26, carbs_g=10, fat_g=14,
         meal_type="dinner", diet_type="non-vegetarian", region="pakistani", allergens="shellfish",
         ingredients="prawns, tomatoes, onion, garlic, ginger, red chilli, oil"),
    dict(food_name="Mushroom Pasta (Whole Wheat)", calories=340, protein_g=12, carbs_g=52, fat_g=10,
         meal_type="dinner", diet_type="vegetarian", region="general", allergens="gluten,dairy",
         ingredients="whole wheat pasta, mushrooms, cream, parmesan, garlic, olive oil"),
    dict(food_name="Grilled Chicken with Sweet Potato", calories=370, protein_g=34, carbs_g=34, fat_g=10,
         meal_type="dinner", diet_type="non-vegetarian", region="general", allergens="",
         ingredients="chicken breast, sweet potato, olive oil, paprika, garlic, herbs"),
    dict(food_name="Lentil Soup (Masoor Dal)", calories=190, protein_g=13, carbs_g=30, fat_g=3,
         meal_type="dinner", diet_type="vegan", region="pakistani", allergens="",
         ingredients="red lentils, tomato, onion, garlic, cumin, turmeric, olive oil"),
    dict(food_name="Egg Curry", calories=220, protein_g=14, carbs_g=8, fat_g=14,
         meal_type="dinner", diet_type="vegetarian", region="pakistani", allergens="eggs",
         ingredients="boiled eggs, tomato, onion, garlic, ginger, chilli, spices, oil"),

    # ── Snacks ───────────────────────────────────────────────────────────────
    dict(food_name="Mixed Nuts", calories=600, protein_g=20, carbs_g=20, fat_g=52,
         meal_type="snack", diet_type="vegan", region="general", allergens="nuts",
         ingredients="almonds, walnuts, cashews, pistachios"),
    dict(food_name="Banana with Peanut Butter", calories=280, protein_g=8, carbs_g=38, fat_g=10,
         meal_type="snack", diet_type="vegan", region="general", allergens="peanuts",
         ingredients="banana, peanut butter"),
    dict(food_name="Roasted Chickpeas", calories=364, protein_g=19, carbs_g=61, fat_g=6,
         meal_type="snack", diet_type="vegan", region="pakistani", allergens="",
         ingredients="chickpeas, olive oil, chaat masala, salt"),
    dict(food_name="Cottage Cheese (Paneer) Cubes", calories=265, protein_g=18, carbs_g=4, fat_g=20,
         meal_type="snack", diet_type="vegetarian", region="general", allergens="dairy",
         ingredients="paneer, black pepper, chilli flakes"),
    dict(food_name="Protein Shake", calories=160, protein_g=25, carbs_g=10, fat_g=3,
         meal_type="snack", diet_type="non-vegetarian", region="general", allergens="dairy",
         ingredients="whey protein, milk, banana"),
    dict(food_name="Apple Slices with Almond Butter", calories=200, protein_g=4, carbs_g=28, fat_g=8,
         meal_type="snack", diet_type="vegan", region="general", allergens="nuts",
         ingredients="apple, almond butter"),
    dict(food_name="Samosa (Baked)", calories=180, protein_g=5, carbs_g=24, fat_g=7,
         meal_type="snack", diet_type="vegetarian", region="pakistani", allergens="gluten",
         ingredients="wheat pastry, potato, peas, cumin, green chilli"),
    dict(food_name="Greek Yogurt with Berries", calories=120, protein_g=10, carbs_g=14, fat_g=2,
         meal_type="snack", diet_type="vegetarian", region="general", allergens="dairy",
         ingredients="greek yogurt, strawberries, blueberries, honey"),
    dict(food_name="Hard Boiled Eggs", calories=155, protein_g=13, carbs_g=1, fat_g=11,
         meal_type="snack", diet_type="non-vegetarian", region="general", allergens="eggs",
         ingredients="eggs, salt"),
    dict(food_name="Date and Walnut Energy Balls", calories=240, protein_g=5, carbs_g=34, fat_g=10,
         meal_type="snack", diet_type="vegan", region="pakistani", allergens="nuts",
         ingredients="dates, walnuts, coconut flakes, oats"),

    # ── Any (multi-purpose) ───────────────────────────────────────────────────
    dict(food_name="Brown Rice with Grilled Chicken", calories=380, protein_g=32, carbs_g=44, fat_g=8,
         meal_type="any", diet_type="non-vegetarian", region="general", allergens="",
         ingredients="brown rice, chicken breast, olive oil, herbs, lemon"),
    dict(food_name="Whole Wheat Roti with Sabzi", calories=200, protein_g=7, carbs_g=34, fat_g=5,
         meal_type="any", diet_type="vegan", region="pakistani", allergens="gluten",
         ingredients="whole wheat flour, mixed vegetables, oil, spices"),
]


def _build_fake_food(d: dict) -> SimpleNamespace:
    """Convert a food dict to a lightweight namespace (not an ORM object, not persisted)."""
    return SimpleNamespace(
        id             = d.get("id") or 0,
        food_name      = d["food_name"],
        calories       = float(d.get("calories") or 0),
        protein_g      = float(d.get("protein_g") or 0),
        carbs_g        = float(d.get("carbs_g") or 0),
        fat_g          = float(d.get("fat_g") or 0),
        fiber_g        = float(d.get("fiber_g") or 0),
        serving_size_g = 100.0,
        meal_type      = d.get("meal_type") or "any",
        diet_type      = d.get("diet_type") or "non-vegetarian",
        region         = d.get("region") or "general",
        allergens      = d.get("allergens") or "",
        ingredients    = d.get("ingredients") or "",
        cuisine        = d.get("cuisine") or d.get("region") or "general",
        source         = d.get("source") or "builtin",
    )


async def _ensure_seeded(db: AsyncSession) -> bool:
    """Return True if nutrition_foods table has data, else seed from BUILTIN_FOODS."""
    result = await db.execute(select(func.count()).select_from(NutritionFood))
    count = result.scalar()
    if count and count > 0:
        return True

    # Seed built-in foods
    for d in BUILTIN_FOODS:
        db.add(NutritionFood(
            food_name    = d["food_name"],
            calories     = float(d["calories"]),
            protein_g    = float(d["protein_g"]),
            carbs_g      = float(d["carbs_g"]),
            fat_g        = float(d["fat_g"]),
            fiber_g      = 0.0,
            serving_size_g = 100.0,
            meal_type    = d["meal_type"],
            diet_type    = d["diet_type"],
            region       = d["region"],
            allergens    = d["allergens"],
            ingredients  = d["ingredients"],
            cuisine      = d["region"],
            source       = "builtin",
        ))
    await db.commit()
    return False


def _scale_meal(food, target_calories: float) -> MealSuggestion:
    if food.calories and food.calories > 0:
        raw_qty = (target_calories / food.calories) * 100
    else:
        raw_qty = 200.0
    qty   = round(min(600.0, max(80.0, raw_qty)), 1)
    scale = qty / 100.0

    return MealSuggestion(
        id         = food.id or 0,
        food_name  = food.food_name,
        meal_type  = food.meal_type,
        quantity_g = qty,
        calories   = round(food.calories   * scale, 1),
        protein_g  = round(food.protein_g  * scale, 1),
        carbs_g    = round(food.carbs_g    * scale, 1),
        fat_g      = round(food.fat_g      * scale, 1),
        cuisine    = getattr(food, "cuisine", None) or "general",
        ingredients= getattr(food, "ingredients", None) or "",
        allergens  = getattr(food, "allergens", None) or "",
    )


def _food_to_dict(food: NutritionFood) -> dict:
    """Convert ORM row \u2192 plain dict for the ML model (applies name/ingredient/allergen cleaning)."""
    return {
        "id":          food.id,
        "food_name":   _clean_food_name(food.food_name or ""),
        "calories":    food.calories   or 0.0,
        "protein_g":   food.protein_g  or 0.0,
        "carbs_g":     food.carbs_g    or 0.0,
        "fat_g":       food.fat_g      or 0.0,
        "fiber_g":     food.fiber_g    or 0.0,
        "meal_type":   food.meal_type  or "any",
        "diet_type":   food.diet_type  or "non-vegetarian",
        "allergens":   _clean_allergens(food.allergens or ""),
        "region":      food.region     or "general",
        "cuisine":     getattr(food, "cuisine", None) or "general",
        "ingredients": _clean_ingredients(getattr(food, "ingredients", None) or ""),
    }


async def _ensure_ml_fitted(db: AsyncSession) -> None:
    """
    Lazily load every food from the DB into the ML recommender singleton.
    Runs once per process; subsequent calls are no-ops.
    """
    rec = get_recommender()
    if rec.is_fitted:
        return

    result = await db.execute(
        select(NutritionFood).where(NutritionFood.calories > 0)
    )
    foods = result.scalars().all()

    if foods:
        rec.fit([_food_to_dict(f) for f in foods])
        logger.info("ML recommender fitted on %d DB foods.", len(foods))
    else:
        # DB empty — fit on built-in library so model is still usable
        rec.fit(BUILTIN_FOODS)
        logger.warning("DB empty — ML recommender fitted on built-in library (%d items).", len(BUILTIN_FOODS))


def _filter_builtin(meal_type: str, diet_types: List[str], allergies: List[str], region: str):
    """Pure-Python hard-filter over BUILTIN_FOODS — used as last-resort fallback."""
    compatible_diets = {"any"} | set(diet_types)
    if "non-vegetarian" in diet_types:
        compatible_diets.update({"vegetarian", "vegan"})
    elif "vegetarian" in diet_types:
        compatible_diets.add("vegan")

    results = []
    for d in BUILTIN_FOODS:
        if d["meal_type"] not in (meal_type, "any"):
            continue
        if d["diet_type"] not in compatible_diets:
            continue
        if allergies:
            al = d.get("allergens", "").lower()
            if any(a.lower() in al for a in allergies if a.strip()):
                continue
        results.append(_build_fake_food(d))
    return results


async def generate_meal_plan(
    db: AsyncSession,
    calorie_target: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    region: str = "general",
    diet_types: Optional[List[str]] = None,
    allergies: Optional[List[str]] = None,
    meals_per_day: int = 3,
) -> DietPlanResponse:
    """
    ML-powered meal plan generation.

    For each meal slot the function:
    1. Computes a per-slot macro target vector (calories, protein, carbs, fat).
    2. Calls MealRecommenderML.recommend() which:
         a. Hard-filters by meal_type / diet_type / allergens.
         b. Scales features with a pre-fitted StandardScaler.
         c. Ranks all candidates by cosine similarity to the target.
         d. Applies a soft +0.15 boost for culturally matching foods.
    3. Randomly picks from the top-5 to add variety across regenerations.
    4. Falls back to the built-in food library if the DB is empty.
    """
    if diet_types is None or len(diet_types) == 0:
        diet_types = ["non-vegetarian"]
    if allergies is None:
        allergies = []

    # Ensure DB has data and ML model is fitted
    await _ensure_seeded(db)
    await _ensure_ml_fitted(db)

    rec         = get_recommender()
    slot_list   = MEAL_CALORIE_SPLITS.get(meals_per_day, MEAL_CALORIE_SPLITS[3])
    plan: dict  = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}
    total_cal = total_pro = total_carb = total_fat = 0.0
    chosen_names: set = set()   # avoid serving the same food twice in one plan

    for slot, fraction in slot_list:
        # Per-slot macro targets
        slot_cal  = calorie_target * fraction
        slot_pro  = protein_g     * fraction
        slot_carb = carbs_g       * fraction
        slot_fat  = fat_g         * fraction

        # ── ML ranking ────────────────────────────────────────────────
        ranked_idx = rec.recommend(
            target_calories = slot_cal,
            target_protein_g= slot_pro,
            target_carbs_g  = slot_carb,
            target_fat_g    = slot_fat,
            meal_type       = slot,
            diet_types      = diet_types,
            allergies       = allergies,
            region          = region,
            top_n           = 20,          # rank 20; we'll filter by novelty then pick
        )

        # Remove already-chosen foods for variety; accept duplicates as last resort
        novel_idx = [i for i in ranked_idx if rec.get_food(i)["food_name"] not in chosen_names]
        best_idx  = novel_idx if novel_idx else ranked_idx

        if best_idx:
            # Stochastic tie-break among the top-5 cosine-ranked candidates
            pick_from = best_idx[:5]
            chosen_i  = random.choice(pick_from)
            food_dict = rec.get_food(chosen_i)

            # Re-construct a lightweight NutritionFood-like object for _scale_meal
            food_obj = _build_fake_food(food_dict)
            food_obj.id = food_dict.get("id") or 0
        else:
            # ── Hard fallback: built-in library ──────────────────────────
            pool = _filter_builtin(slot, diet_types, allergies, region)
            if not pool:
                pool = _filter_builtin("any", diet_types, allergies, region)
            if not pool:
                pool = [_build_fake_food(random.choice(BUILTIN_FOODS))]
            fresh = [f for f in pool if f.food_name not in chosen_names] or pool
            food_obj = random.choice(fresh[:5])

        chosen_names.add(food_obj.food_name)
        item = _scale_meal(food_obj, slot_cal)

        plan[slot].append(item)
        total_cal  += item.calories
        total_pro  += item.protein_g
        total_carb += item.carbs_g
        total_fat  += item.fat_g

    tips = random.sample(DIET_TIPS, min(3, len(DIET_TIPS)))

    return DietPlanResponse(
        calorie_target  = calorie_target,
        breakfast       = plan["breakfast"],
        lunch           = plan["lunch"],
        dinner          = plan["dinner"],
        snacks          = plan["snack"],
        total_calories  = round(total_cal,  1),
        total_protein_g = round(total_pro,  1),
        total_carbs_g   = round(total_carb, 1),
        total_fat_g     = round(total_fat,  1),
        water_ml        = 2500.0,
        tips            = tips,
    )
