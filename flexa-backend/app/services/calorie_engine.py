"""
Module 3 – Calorie Engine Service
Implements:
- Mifflin-St Jeor BMR formula
- TDEE with activity multipliers
- Goal-based calorie adjustment (deficit/surplus)
- Macro split based on goal
- Daily water recommendation
"""
from app.schemas.diet import CalorieCalculatorRequest, CalorieCalculatorResponse


# Activity level multipliers (Harris-Benedict / Mifflin-St Jeor standard)
ACTIVITY_MULTIPLIERS = {
    "sedentary":          1.2,    # desk job, little/no exercise
    "lightly_active":     1.375,  # light exercise 1-3 days/week
    "moderately_active":  1.55,   # moderate exercise 3-5 days/week
    "very_active":        1.725,  # hard exercise 6-7 days/week
    "extremely_active":   1.9,    # physical job + hard training twice/day
}

# Goal-based calorie adjustment and macro ratios
GOAL_CONFIG = {
    "fat_loss": {
        "calorie_delta":   -500,   # 500 kcal deficit → ~0.5 kg/week fat loss
        "protein_ratio":   0.35,   # higher protein to preserve muscle
        "carbs_ratio":     0.35,
        "fat_ratio":       0.30,
        "water_base_ml":   3000,   # higher hydration during deficit
        "summary": "500 kcal daily deficit — targets ~0.5 kg/week sustainable fat loss.",
    },
    "muscle_gain": {
        "calorie_delta":   +300,   # lean bulk surplus
        "protein_ratio":   0.30,
        "carbs_ratio":     0.45,
        "fat_ratio":       0.25,
        "water_base_ml":   3500,
        "summary": "300 kcal lean bulk surplus — targets muscle growth with minimal fat gain.",
    },
    "maintenance": {
        "calorie_delta":   0,
        "protein_ratio":   0.25,
        "carbs_ratio":     0.50,
        "fat_ratio":       0.25,
        "water_base_ml":   2500,
        "summary": "Maintenance calories — balanced macros to sustain current body composition.",
    },
}

# Calories per gram of macronutrient
KCAL_PER_G = {"protein": 4, "carbs": 4, "fat": 9}


def calculate_bmr(age: int, gender: str, weight_kg: float, height_cm: float) -> float:
    """
    Mifflin-St Jeor equation (most accurate for general population):
      Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
      Female: 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
    Returns kcal/day at rest.
    """
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return round(base + (5 if gender == "male" else -161), 2)


def calculate_tdee(bmr: float, activity_level: str) -> float:
    """
    Total Daily Energy Expenditure = BMR × activity multiplier.
    """
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    return round(bmr * multiplier, 2)


def calculate_calorie_target(tdee: float, goal: str) -> float:
    """
    Adjust TDEE by goal delta. Enforces minimum safe calorie floor (1200 kcal).
    """
    delta = GOAL_CONFIG.get(goal, GOAL_CONFIG["maintenance"])["calorie_delta"]
    return round(max(1200, tdee + delta), 2)


def calculate_macros(calorie_target: float, goal: str) -> dict:
    """
    Split calorie target into protein/carbs/fat grams based on goal ratios.
    Returns {'protein_g', 'carbs_g', 'fat_g'}.
    """
    cfg = GOAL_CONFIG.get(goal, GOAL_CONFIG["maintenance"])
    return {
        "protein_g": round((calorie_target * cfg["protein_ratio"]) / KCAL_PER_G["protein"], 1),
        "carbs_g":   round((calorie_target * cfg["carbs_ratio"])   / KCAL_PER_G["carbs"],   1),
        "fat_g":     round((calorie_target * cfg["fat_ratio"])     / KCAL_PER_G["fat"],     1),
    }


def calculate_water(weight_kg: float, goal: str) -> float:
    """
    Water recommendation: 35 ml/kg body weight + goal-specific base.
    Minimum 2000 ml, maximum 5000 ml.
    """
    base = GOAL_CONFIG.get(goal, GOAL_CONFIG["maintenance"])["water_base_ml"]
    weight_based = weight_kg * 35
    return round(min(5000, max(2000, (weight_based + base) / 2)), 0)


def run_calorie_calculator(req: CalorieCalculatorRequest) -> CalorieCalculatorResponse:
    """
    Full pipeline: BMR → TDEE → Target → Macros → Water.
    """
    goal_cfg   = GOAL_CONFIG.get(req.goal, GOAL_CONFIG["maintenance"])
    activity   = req.activity_level if req.activity_level in ACTIVITY_MULTIPLIERS else "moderately_active"

    bmr        = calculate_bmr(req.age, req.gender, req.weight_kg, req.height_cm)
    tdee       = calculate_tdee(bmr, activity)
    calorie_t  = calculate_calorie_target(tdee, req.goal)
    macros     = calculate_macros(calorie_t, req.goal)
    water      = calculate_water(req.weight_kg, req.goal)
    summary    = goal_cfg["summary"]

    return CalorieCalculatorResponse(
        bmr=bmr,
        tdee=tdee,
        calorie_target=calorie_t,
        protein_g=macros["protein_g"],
        carbs_g=macros["carbs_g"],
        fat_g=macros["fat_g"],
        water_ml=water,
        goal=req.goal,
        activity_level=activity,
        summary=summary,
    )
