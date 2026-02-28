"""
Milestone Detection Algorithm
Detects fitness milestones from user progress data.
"""
from typing import List, Dict, Any, Optional
from datetime import date


MILESTONE_DEFINITIONS = [
    {
        "id": "first_workout",
        "title": "First Step",
        "description": "Completed your very first workout session!",
        "badge_type": "starter",
        "condition": lambda data: data.get("total_sessions", 0) >= 1,
    },
    {
        "id": "week_streak",
        "title": "7-Day Warrior",
        "description": "Logged activity for 7 consecutive days!",
        "badge_type": "streak",
        "condition": lambda data: data.get("streak_days", 0) >= 7,
    },
    {
        "id": "ten_sessions",
        "title": "Dedicated",
        "description": "Completed 10 workout sessions!",
        "badge_type": "milestone",
        "condition": lambda data: data.get("total_sessions", 0) >= 10,
    },
    {
        "id": "twenty_five_sessions",
        "title": "Committed",
        "description": "Completed 25 workout sessions!",
        "badge_type": "milestone",
        "condition": lambda data: data.get("total_sessions", 0) >= 25,
    },
    {
        "id": "fifty_sessions",
        "title": "Elite Athlete",
        "description": "Reached 50 workout sessions — elite level!",
        "badge_type": "elite",
        "condition": lambda data: data.get("total_sessions", 0) >= 50,
    },
    {
        "id": "weight_loss_5",
        "title": "5kg Down",
        "description": "Lost 5 kg from your starting weight!",
        "badge_type": "progress",
        "condition": lambda data: data.get("weight_lost_kg", 0) >= 5,
    },
    {
        "id": "weight_loss_10",
        "title": "10kg Transformation",
        "description": "Lost 10 kg — incredible transformation!",
        "badge_type": "elite",
        "condition": lambda data: data.get("weight_lost_kg", 0) >= 10,
    },
    {
        "id": "bmi_normal",
        "title": "Healthy BMI",
        "description": "Achieved a healthy BMI range (18.5–24.9)!",
        "badge_type": "health",
        "condition": lambda data: 18.5 <= data.get("current_bmi", 0) <= 24.9,
    },
    {
        "id": "month_member",
        "title": "One Month Strong",
        "description": "Been on your Flexa journey for 30 days!",
        "badge_type": "tenure",
        "condition": lambda data: data.get("days_since_joined", 0) >= 30,
    },
]


def detect_milestones(user_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect which milestones a user has earned."""
    earned = []
    for milestone in MILESTONE_DEFINITIONS:
        try:
            if milestone["condition"](user_data):
                earned.append({
                    "id": milestone["id"],
                    "title": milestone["title"],
                    "description": milestone["description"],
                    "badge_type": milestone["badge_type"],
                    "milestone_type": milestone["badge_type"],
                })
        except Exception:
            continue
    return earned


def generate_progress_summary(logs: List[Dict], goal_type: str) -> Dict[str, Any]:
    """Generate weekly/monthly progress summary."""
    if not logs:
        return {"message": "No progress logs yet. Start logging your weight and workouts!"}

    weights = [l.get("weight_kg") for l in logs if l.get("weight_kg")]
    bmis = [l.get("bmi") for l in logs if l.get("bmi")]

    summary = {}

    if weights:
        summary["start_weight"] = weights[0]
        summary["current_weight"] = weights[-1]
        summary["weight_change"] = round(weights[-1] - weights[0], 2)
        summary["avg_weight"] = round(sum(weights) / len(weights), 2)

    if bmis:
        summary["start_bmi"] = round(bmis[0], 2)
        summary["current_bmi"] = round(bmis[-1], 2)
        summary["bmi_change"] = round(bmis[-1] - bmis[0], 2)

    summary["total_logs"] = len(logs)
    summary["trend"] = _compute_trend(weights, goal_type)

    return summary


def _compute_trend(weights: List[float], goal_type: str) -> str:
    if len(weights) < 2:
        return "insufficient_data"
    change = weights[-1] - weights[0]
    if goal_type == "bulking":
        return "on_track" if change > 0 else "below_target"
    elif goal_type == "cutting":
        return "on_track" if change < 0 else "above_target"
    else:
        return "stable" if abs(change) < 1 else "fluctuating"
