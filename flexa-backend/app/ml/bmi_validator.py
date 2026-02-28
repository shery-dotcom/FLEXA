"""
BMI-Goal Validation Model
Rule-based + ML hybrid for validating fitness goals against BMI.
"""
from typing import Dict, Any


BMI_GOAL_RULES = {
    "bulking": {"min_bmi": 15.0, "max_bmi": 27.0, "ideal_range": (18.5, 25.0)},
    "cutting":  {"min_bmi": 18.0, "max_bmi": 40.0, "ideal_range": (22.0, 35.0)},
    "recomp":   {"min_bmi": 17.0, "max_bmi": 35.0, "ideal_range": (20.0, 30.0)},
}

ACTIVITY_MULTIPLIERS = {
    "sedentary":   1.0,
    "light":       1.2,
    "moderate":    1.4,
    "active":      1.6,
    "very_active": 1.8,
}


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    height_m = height_cm / 100
    return round(weight_kg / (height_m ** 2), 2)


def classify_bmi(bmi: float) -> str:
    if bmi < 18.5:
        return "Underweight"
    elif bmi < 25.0:
        return "Normal"
    elif bmi < 30.0:
        return "Overweight"
    else:
        return "Obese"


def validate_goal_against_bmi(
    bmi: float,
    goal_type: str,
    activity_level: str,
) -> Dict[str, Any]:
    """Rule-based goal validation with ML scoring."""
    rules = BMI_GOAL_RULES.get(goal_type, {})
    bmi_category = classify_bmi(bmi)
    activity_multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.0)

    warnings = []
    recommendations = []
    is_valid = True

    if rules:
        if bmi < rules["min_bmi"]:
            is_valid = False
            warnings.append(f"Your BMI ({bmi}) is too low for {goal_type}. Consider increasing caloric intake first.")
        elif bmi > rules["max_bmi"]:
            warnings.append(f"Your BMI ({bmi}) is above typical range for {goal_type}. Proceed with caution.")

        ideal_low, ideal_high = rules["ideal_range"]
        if ideal_low <= bmi <= ideal_high:
            recommendations.append(f"Your BMI is in the ideal range for {goal_type}.")
        else:
            recommendations.append(f"Target BMI range for {goal_type}: {ideal_low}–{ideal_high}.")

    # ML-style scoring (rule-based scoring heuristic)
    ml_score = _compute_ml_score(bmi, goal_type, activity_multiplier)

    return {
        "is_valid": is_valid,
        "bmi": bmi,
        "bmi_category": bmi_category,
        "goal_type": goal_type,
        "activity_level": activity_level,
        "ml_score": round(ml_score, 3),
        "warnings": warnings,
        "recommendations": recommendations,
        "next_steps": _generate_next_steps(goal_type, bmi_category, activity_level),
    }


def _compute_ml_score(bmi: float, goal_type: str, activity_multiplier: float) -> float:
    """Heuristic ML score: 0–1 indicating how well BMI aligns with goal."""
    rules = BMI_GOAL_RULES.get(goal_type, {})
    if not rules:
        return 0.5

    ideal_low, ideal_high = rules["ideal_range"]
    ideal_mid = (ideal_low + ideal_high) / 2
    distance = abs(bmi - ideal_mid)
    max_distance = max(ideal_mid - rules["min_bmi"], rules["max_bmi"] - ideal_mid)
    bmi_score = max(0, 1 - (distance / max_distance)) if max_distance > 0 else 0
    return min(1.0, bmi_score * activity_multiplier * 0.7 + 0.3)


def _generate_next_steps(goal_type: str, bmi_category: str, activity_level: str) -> list:
    steps = {
        "bulking": [
            "Increase daily calorie intake by 300–500 kcal",
            "Focus on compound lifts (squat, deadlift, bench)",
            "Prioritize 7–9 hours of sleep for muscle recovery",
        ],
        "cutting": [
            "Create a 300–500 kcal daily deficit",
            "Increase cardio to 3–4 sessions per week",
            "Track protein intake — target 2g per kg bodyweight",
        ],
        "recomp": [
            "Maintain caloric maintenance (TDEE)",
            "Combine strength training with moderate cardio",
            "Monitor body composition weekly",
        ],
    }
    return steps.get(goal_type, [])
