"""
Module 3 – Diet Service (FE-4, FE-5)
Utility functions for:
  - Hydration reminders (API-ready, no external scheduler required)
  - Meal timing reminders
  - Meal log editing helpers
  - Daily progress percentage computation
"""
from datetime import datetime, time
from typing import List, Tuple


# ─────────────────────────── Hydration Reminder ────────────────────────────

# Recommended drink windows (hour_start, hour_end, message)
HYDRATION_SCHEDULE: List[Tuple[int, int, str]] = [
    (6,  8,  "Start your morning with 2 glasses of water before breakfast."),
    (9,  10, "Mid-morning hydration: drink a glass of water now."),
    (12, 13, "Before lunch, drink water to aid digestion and reduce appetite."),
    (15, 16, "Afternoon slump? Water helps more than coffee right now."),
    (17, 18, "Pre-workout hydration: drink 400–600 ml 30 min before exercise."),
    (20, 21, "Evening check — have you hit your water goal for today?"),
    (22, 23, "Wind down: a glass of water before bed aids overnight recovery."),
]

MEAL_REMINDERS: List[Tuple[int, int, str]] = [
    (7,   9,  "Breakfast time! A balanced breakfast kick-starts your metabolism."),
    (12, 14,  "Time for lunch. Don't skip — it keeps energy stable through the afternoon."),
    (19, 20,  "Dinner reminder. Keep it lighter than lunch for better sleep."),
    (15, 17,  "Snack window: reach for a protein-rich option if you're hungry."),
]


def get_current_reminders(water_target_ml: float = 2500.0) -> dict:
    """
    Return the applicable hydration and meal reminder for the current time.
    Called by the /diet/reminders endpoint; no push system required.

    Returns:
        {
          "hydration": {"message": str, "glass_count": int, "target_ml": float},
          "meal":      {"message": str} | None,
          "timestamp": str
        }
    """
    now = datetime.now()
    hour = now.hour

    # Hydration
    hydration_msg = "Stay hydrated! Aim for a glass of water every hour."
    for h_start, h_end, msg in HYDRATION_SCHEDULE:
        if h_start <= hour < h_end:
            hydration_msg = msg
            break

    glasses_target = round(water_target_ml / 250)

    # Meal reminder
    meal_msg = None
    for m_start, m_end, msg in MEAL_REMINDERS:
        if m_start <= hour < m_end:
            meal_msg = {"message": msg}
            break

    return {
        "hydration": {
            "message":     hydration_msg,
            "glass_count": glasses_target,
            "target_ml":   water_target_ml,
        },
        "meal":      meal_msg,
        "timestamp": now.isoformat(),
    }


# ─────────────────────────── Progress Computation ──────────────────────────

def compute_daily_progress(
    calories_consumed: float,
    calorie_target: float,
    protein_consumed: float,
    protein_target: float,
    water_consumed_ml: float = 0,
    water_target_ml: float = 2500,
) -> dict:
    """
    Compute percentage completion for each tracked metric.
    Used by the daily summary response and dashboard widget.
    """
    def pct(consumed, target):
        if target <= 0:
            return 0.0
        return round(min(100.0, (consumed / target) * 100), 1)

    calorie_pct = pct(calories_consumed, calorie_target)
    protein_pct = pct(protein_consumed, protein_target)
    water_pct   = pct(water_consumed_ml, water_target_ml)

    # Traffic-light status
    if calorie_pct < 50:
        status = "under"
    elif calorie_pct <= 105:
        status = "on_track"
    else:
        status = "over"

    return {
        "calorie_pct": calorie_pct,
        "protein_pct": protein_pct,
        "water_pct":   water_pct,
        "status":      status,
        "on_track":    status == "on_track",
        "overeaten":   status == "over",
    }


# ─────────────────────────── Macro Split Explanation ───────────────────────

def macro_split_explanation(goal: str) -> str:
    """
    Return a human-readable explanation of the macro split for FYP docs / UI tooltip.
    """
    explanations = {
        "fat_loss": (
            "Fat loss protocol: 35% calories from protein (muscle preservation), "
            "35% from carbs (sustained energy), 30% from fat (hormonal balance). "
            "500 kcal deficit targets 0.5 kg/week loss."
        ),
        "muscle_gain": (
            "Lean bulk protocol: 30% protein (muscle synthesis), "
            "45% carbs (fuel for training), 25% fat. "
            "300 kcal surplus minimizes fat gain during musclebuilding."
        ),
        "maintenance": (
            "Maintenance protocol: 25% protein, 50% carbs, 25% fat. "
            "Balances all macros at TDEE to sustain current composition."
        ),
    }
    return explanations.get(goal, "Balanced macronutrient distribution.")
