"""
Motivation Scoring Engine
Analyzes user activity and generates motivational messages with scores.
"""
import random
from typing import Dict, Any
from datetime import date, timedelta


MOTIVATIONAL_MESSAGES = {
    "high": [
        "You're absolutely crushing it! Keep that momentum going!",
        "Elite performance mode activated. Nothing can stop you!",
        "Your dedication is inspiring. The results will follow!",
        "Champions are made in moments like this. You are one.",
    ],
    "medium": [
        "You're on the right track. Stay consistent and the results will come.",
        "Progress is progress, no matter how small. Keep moving forward.",
        "Every rep counts. You're building something great.",
        "Consistency beats perfection. You're showing up — that's what matters.",
    ],
    "low": [
        "Getting started is the hardest part. You've already won.",
        "Today's effort is tomorrow's strength. Take it one step at a time.",
        "Your body is capable of more than your mind believes.",
        "Small steps every day lead to massive transformations.",
    ],
    "starting": [
        "Welcome to your Flexa journey! Every legend started from day one.",
        "The best time to start was yesterday. The second best time is now.",
        "Your transformation begins today. Let's build something extraordinary.",
    ],
}

GOAL_AFFIRMATIONS = {
    "bulking": "Fuel your gains. Every meal and rep is an investment in muscle.",
    "cutting": "Lean and mean. Your discipline is sculpting your best physique.",
    "recomp": "Body recomposition is the ultimate challenge — you're up for it.",
}


def compute_motivation_score(
    sessions_this_week: int,
    frequency_goal: int,
    streak_days: int,
    goal_type: str,
    days_since_joined: int,
) -> Dict[str, Any]:
    """Compute motivation score and generate personalized message."""

    # Base score from workout adherence
    adherence = sessions_this_week / max(frequency_goal, 1)
    adherence_score = min(adherence, 1.0) * 50  # max 50 points

    # Streak bonus
    streak_score = min(streak_days * 3, 30)  # max 30 points

    # Tenure bonus
    tenure_score = min(days_since_joined / 100, 1.0) * 20  # max 20 points

    total_score = adherence_score + streak_score + tenure_score
    normalized = round(total_score / 100, 3)

    # Determine category
    if days_since_joined <= 3:
        category = "starting"
    elif normalized >= 0.7:
        category = "high"
    elif normalized >= 0.4:
        category = "medium"
    else:
        category = "low"

    message = random.choice(MOTIVATIONAL_MESSAGES[category])
    affirmation = GOAL_AFFIRMATIONS.get(goal_type, "")

    return {
        "motivation_score": normalized,
        "category": category,
        "message": message,
        "affirmation": affirmation,
        "streak_days": streak_days,
        "adherence_rate": round(adherence, 2),
    }
