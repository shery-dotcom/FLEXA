"""
AI Workout Recommendation Engine
Rule-based + ML hybrid workout generator.
"""
from typing import List, Dict, Any


# Exercise database organized by muscle group and difficulty
EXERCISE_DB: Dict[str, Dict[str, List[Dict]]] = {
    "chest": {
        "beginner": [
            {"name": "Push-ups", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "none"},
            {"name": "Incline Push-ups", "sets": 3, "reps": "12-15", "rest_seconds": 60, "equipment": "bench"},
        ],
        "intermediate": [
            {"name": "Barbell Bench Press", "sets": 4, "reps": "8-10", "rest_seconds": 90, "equipment": "barbell"},
            {"name": "Dumbbell Fly", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "dumbbells"},
            {"name": "Cable Crossover", "sets": 3, "reps": "12-15", "rest_seconds": 60, "equipment": "cable"},
        ],
        "advanced": [
            {"name": "Weighted Dips", "sets": 4, "reps": "6-8", "rest_seconds": 120, "equipment": "dip_bar"},
            {"name": "Incline Barbell Press", "sets": 4, "reps": "6-8", "rest_seconds": 120, "equipment": "barbell"},
        ],
    },
    "back": {
        "beginner": [
            {"name": "Assisted Pull-ups", "sets": 3, "reps": "8-10", "rest_seconds": 90, "equipment": "pull_up_bar"},
            {"name": "Dumbbell Row", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "dumbbells"},
        ],
        "intermediate": [
            {"name": "Barbell Deadlift", "sets": 4, "reps": "6-8", "rest_seconds": 120, "equipment": "barbell"},
            {"name": "Pull-ups", "sets": 4, "reps": "8-10", "rest_seconds": 90, "equipment": "pull_up_bar"},
            {"name": "Seated Cable Row", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "cable"},
        ],
        "advanced": [
            {"name": "Weighted Pull-ups", "sets": 4, "reps": "6-8", "rest_seconds": 120, "equipment": "pull_up_bar"},
            {"name": "T-Bar Row", "sets": 4, "reps": "6-8", "rest_seconds": 90, "equipment": "barbell"},
        ],
    },
    "legs": {
        "beginner": [
            {"name": "Bodyweight Squats", "sets": 3, "reps": "12-15", "rest_seconds": 60, "equipment": "none"},
            {"name": "Walking Lunges", "sets": 3, "reps": "10 each", "rest_seconds": 60, "equipment": "none"},
        ],
        "intermediate": [
            {"name": "Barbell Squat", "sets": 4, "reps": "8-10", "rest_seconds": 120, "equipment": "barbell"},
            {"name": "Romanian Deadlift", "sets": 3, "reps": "10-12", "rest_seconds": 90, "equipment": "barbell"},
            {"name": "Leg Press", "sets": 4, "reps": "10-12", "rest_seconds": 90, "equipment": "machine"},
        ],
        "advanced": [
            {"name": "Front Squat", "sets": 4, "reps": "6-8", "rest_seconds": 120, "equipment": "barbell"},
            {"name": "Bulgarian Split Squat", "sets": 3, "reps": "8-10", "rest_seconds": 90, "equipment": "dumbbells"},
        ],
    },
    "shoulders": {
        "beginner": [
            {"name": "Dumbbell Shoulder Press", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "dumbbells"},
            {"name": "Lateral Raises", "sets": 3, "reps": "12-15", "rest_seconds": 45, "equipment": "dumbbells"},
        ],
        "intermediate": [
            {"name": "Barbell Overhead Press", "sets": 4, "reps": "8-10", "rest_seconds": 90, "equipment": "barbell"},
            {"name": "Arnold Press", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "dumbbells"},
        ],
        "advanced": [
            {"name": "Push Press", "sets": 4, "reps": "6-8", "rest_seconds": 120, "equipment": "barbell"},
            {"name": "Seated DB Lateral Raise", "sets": 4, "reps": "12-15", "rest_seconds": 45, "equipment": "dumbbells"},
        ],
    },
    "arms": {
        "beginner": [
            {"name": "Dumbbell Curl", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "dumbbells"},
            {"name": "Tricep Dips", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "bench"},
        ],
        "intermediate": [
            {"name": "Barbell Curl", "sets": 3, "reps": "8-10", "rest_seconds": 60, "equipment": "barbell"},
            {"name": "Skull Crushers", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "barbell"},
            {"name": "Hammer Curl", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "dumbbells"},
        ],
        "advanced": [
            {"name": "Preacher Curl", "sets": 4, "reps": "8-10", "rest_seconds": 60, "equipment": "barbell"},
            {"name": "Close-grip Bench Press", "sets": 4, "reps": "6-8", "rest_seconds": 90, "equipment": "barbell"},
        ],
    },
    "core": {
        "beginner": [
            {"name": "Plank", "sets": 3, "reps": "30s hold", "rest_seconds": 45, "equipment": "none"},
            {"name": "Crunches", "sets": 3, "reps": "15-20", "rest_seconds": 45, "equipment": "none"},
        ],
        "intermediate": [
            {"name": "Cable Crunch", "sets": 3, "reps": "12-15", "rest_seconds": 45, "equipment": "cable"},
            {"name": "Hanging Leg Raise", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "pull_up_bar"},
        ],
        "advanced": [
            {"name": "Dragon Flag", "sets": 3, "reps": "6-8", "rest_seconds": 90, "equipment": "bench"},
            {"name": "Ab Wheel Rollout", "sets": 3, "reps": "10-12", "rest_seconds": 60, "equipment": "ab_wheel"},
        ],
    },
}

WARMUP_EXERCISES = [
    {"name": "Light Cardio (Jog/Jump Rope)", "duration": "5 min", "intensity": "low"},
    {"name": "Arm Circles", "duration": "1 min", "intensity": "low"},
    {"name": "Leg Swings", "duration": "1 min", "intensity": "low"},
    {"name": "Hip Rotations", "duration": "1 min", "intensity": "low"},
    {"name": "Dynamic Stretching", "duration": "3 min", "intensity": "low"},
]

COOLDOWN_EXERCISES = [
    {"name": "Static Chest Stretch", "duration": "30s each side", "intensity": "low"},
    {"name": "Hamstring Stretch", "duration": "30s each leg", "intensity": "low"},
    {"name": "Quad Stretch", "duration": "30s each leg", "intensity": "low"},
    {"name": "Shoulder Cross Stretch", "duration": "30s each arm", "intensity": "low"},
    {"name": "Child's Pose", "duration": "1 min", "intensity": "low"},
]

# ── ML-predicted split templates ─────────────────────────────────────────────
# Keyed by split name returned by the ML predictor.
# Each inner list is a list of days, each day a list of muscle groups.
ML_SPLIT_TEMPLATES: Dict[str, List[List[str]]] = {
    # ── Full Body ────────────────────────────────────────────────────────────
    # All major muscle groups trained every session (2-3 days/week)
    "Full Body": [
        ["chest", "back", "legs", "shoulders", "arms", "core"],
        ["chest", "back", "legs", "shoulders", "arms", "core"],
        ["chest", "back", "legs", "shoulders", "arms", "core"],
    ],
    # ── Push / Pull / Legs ───────────────────────────────────────────────────
    # Classic 3-day cycle
    "PPL": [
        ["chest", "shoulders", "arms"],  # Push
        ["back", "arms"],                # Pull
        ["legs", "core"],                # Legs
    ],
    # ── PPL x2 ───────────────────────────────────────────────────────────────
    # 6-day: run PPL twice per week
    "PPL x2": [
        ["chest", "shoulders", "arms"],  # Push A
        ["back", "arms"],                # Pull A
        ["legs", "core"],                # Legs A
        ["chest", "shoulders"],          # Push B
        ["back", "core"],               # Pull B
        ["legs"],                        # Legs B
    ],
    # ── Upper / Lower ────────────────────────────────────────────────────────
    # 4-day alternating
    "Upper/Lower": [
        ["chest", "back", "shoulders", "arms"],  # Upper A
        ["legs", "core"],                         # Lower A
        ["chest", "back", "shoulders", "arms"],  # Upper B
        ["legs", "core"],                         # Lower B
    ],
    # ── Bro Split ────────────────────────────────────────────────────────────
    # 5-day one muscle group per day
    "Bro Split": [
        ["chest"],
        ["back"],
        ["shoulders"],
        ["arms"],
        ["legs", "core"],
    ],
}

# Distribution maps for how many workout days each ML split uses
ML_SPLIT_DAY_COUNTS: Dict[str, int] = {
    "Full Body":    3,
    "PPL":          3,
    "PPL x2":       6,
    "Upper/Lower":  4,
    "Bro Split":    5,
}

# ── Frequency-based split templates ──────────────────────────────────────────
# Weekly split templates
SPLIT_TEMPLATES = {
    3: [
        ["chest", "shoulders", "arms"],
        ["back", "core"],
        ["legs"],
    ],
    4: [
        ["chest", "shoulders"],
        ["back", "core"],
        ["legs"],
        ["arms", "core"],
    ],
    5: [
        ["chest"],
        ["back"],
        ["legs"],
        ["shoulders", "arms"],
        ["core", "cardio"],
    ],
    6: [
        ["chest", "arms"],
        ["back", "core"],
        ["legs"],
        ["shoulders", "arms"],
        ["back", "chest"],
        ["legs", "core"],
    ],
}

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def determine_difficulty(bmi: float, activity_level: str, experience_level: str | None = None) -> str:
    if experience_level in ("beginner", "intermediate", "advanced"):
        return experience_level
    activity_scores = {"sedentary": 0, "light": 1, "moderate": 2, "active": 3, "very_active": 4}
    score = activity_scores.get(activity_level, 0)
    if score <= 1:
        return "beginner"
    elif score <= 3:
        return "intermediate"
    return "advanced"


def generate_workout_plan(
    goal_type: str,
    activity_level: str,
    bmi: float,
    frequency_per_week: int,
    week_number: int = 1,
    split_type: str | None = None,
    experience_level: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Generate a full weekly workout plan.

    If split_type is provided (from ML predictor), the plan uses the
    ML-recommended split structure.  Otherwise falls back to the
    frequency-based templates.
    """
    difficulty = determine_difficulty(bmi, activity_level, experience_level)

    if split_type and split_type in ML_SPLIT_TEMPLATES:
        # ── ML-predicted split path ──────────────────────────────────────────
        ml_split   = ML_SPLIT_TEMPLATES[split_type]
        # ALWAYS respect the user-selected frequency, not the template length.
        # The ML split provides the muscle-group pattern; we cycle through it.
        n_workout_days = max(2, min(6, frequency_per_week))

        # Distribute evenly; for PPL x2 (6 days) use Mon-Sat
        _DIST_BY_COUNT = {
            2: [0, 3],
            3: [0, 2, 4],
            4: [0, 1, 3, 4],
            5: [0, 1, 2, 3, 4],
            6: [0, 1, 2, 3, 4, 5],
        }
        workout_day_indices = _DIST_BY_COUNT.get(n_workout_days, [0, 2, 4])
        workouts = []
        split_day_ptr = 0

        for day_idx, day_name in enumerate(DAYS_OF_WEEK):
            if day_idx in workout_day_indices:
                muscle_groups = ml_split[split_day_ptr % len(ml_split)]
                exercises     = _get_exercises_for_groups(muscle_groups, difficulty, goal_type)
                duration      = _estimate_duration(exercises)
                # Build a readable day label
                label = _split_day_label(split_type, split_day_ptr, muscle_groups)
                workouts.append({
                    "name": label,
                    "week_number": week_number,
                    "day_of_week": day_name,
                    "is_rest_day": False,
                    "exercises": exercises,
                    "warmup": WARMUP_EXERCISES[:3],
                    "cooldown": COOLDOWN_EXERCISES[:3],
                    "duration_minutes": duration,
                    "difficulty": difficulty,
                    "ai_generated": True,
                })
                split_day_ptr += 1
            else:
                workouts.append({
                    "name": "Rest Day",
                    "week_number": week_number,
                    "day_of_week": day_name,
                    "is_rest_day": True,
                    "exercises": [],
                    "warmup": [],
                    "cooldown": [],
                    "duration_minutes": 0,
                    "difficulty": difficulty,
                    "ai_generated": True,
                })

        return workouts

    # ── Frequency-based fallback path ─────────────────────────────────────────
    if frequency_per_week not in SPLIT_TEMPLATES:
        frequency_per_week = 3

    split = SPLIT_TEMPLATES[frequency_per_week]
    workouts = []
    workout_day_indices = _distribute_workout_days(frequency_per_week)

    for day_idx, day_name in enumerate(DAYS_OF_WEEK):
        if day_idx in workout_day_indices:
            split_index = workout_day_indices.index(day_idx)
            muscle_groups = split[split_index % len(split)]
            exercises = _get_exercises_for_groups(muscle_groups, difficulty, goal_type)
            duration = _estimate_duration(exercises)
            workouts.append({
                "name": f"{' & '.join(mg.title() for mg in muscle_groups)} Day",
                "week_number": week_number,
                "day_of_week": day_name,
                "is_rest_day": False,
                "exercises": exercises,
                "warmup": WARMUP_EXERCISES[:3],
                "cooldown": COOLDOWN_EXERCISES[:3],
                "duration_minutes": duration,
                "difficulty": difficulty,
                "ai_generated": True,
            })
        else:
            workouts.append({
                "name": "Rest Day",
                "week_number": week_number,
                "day_of_week": day_name,
                "is_rest_day": True,
                "exercises": [],
                "warmup": [],
                "cooldown": [],
                "duration_minutes": 0,
                "difficulty": difficulty,
                "ai_generated": True,
            })

    return workouts


def _split_day_label(split_type: str, day_ptr: int, muscle_groups: List[str]) -> str:
    """Return a human-readable workout name for an ML-split day."""
    muscle_str = " & ".join(mg.title() for mg in muscle_groups)
    if split_type == "Full Body":
        return "Full Body Day"
    if split_type in ("PPL", "PPL x2"):
        cycle_labels = ["Push", "Pull", "Legs"]
        return f"{cycle_labels[day_ptr % 3]} Day ({muscle_str})"
    if split_type == "Upper/Lower":
        return f"{'Upper' if day_ptr % 2 == 0 else 'Lower'} Body Day"
    if split_type == "Bro Split":
        return f"{muscle_str} Day"
    return f"{muscle_str} Day"


def _distribute_workout_days(frequency: int) -> List[int]:
    """Distribute workout days evenly across the week."""
    distributions = {
        3: [0, 2, 4],         # Mon, Wed, Fri
        4: [0, 1, 3, 4],      # Mon, Tue, Thu, Fri
        5: [0, 1, 2, 4, 5],   # Mon–Wed, Fri, Sat
        6: [0, 1, 2, 3, 4, 5], # Mon–Sat
    }
    return distributions.get(frequency, [0, 2, 4])


def _get_exercises_for_groups(muscle_groups: List[str], difficulty: str, goal_type: str) -> List[Dict]:
    exercises = []
    for group in muscle_groups:
        group_exercises = EXERCISE_DB.get(group, {}).get(difficulty, [])
        # Adjust volume based on goal
        adjusted = _adjust_for_goal(group_exercises, goal_type)
        exercises.extend(adjusted[:2])  # max 2 per muscle group
    return exercises


def _adjust_for_goal(exercises: List[Dict], goal_type: str) -> List[Dict]:
    """Adjust sets/reps based on fitness goal."""
    adjusted = []
    for ex in exercises:
        ex_copy = ex.copy()
        if goal_type == "bulking":
            ex_copy["sets"] = ex_copy.get("sets", 3) + 1
            ex_copy["reps"] = "6-8"
            ex_copy["rest_seconds"] = 120
        elif goal_type == "cutting":
            ex_copy["reps"] = "12-15"
            ex_copy["rest_seconds"] = 45
        else:  # recomp
            ex_copy["reps"] = "10-12"
            ex_copy["rest_seconds"] = 75
        adjusted.append(ex_copy)
    return adjusted


def _estimate_duration(exercises: List[Dict]) -> int:
    """Estimate workout duration in minutes."""
    if not exercises:
        return 0
    total_sets = sum(ex.get("sets", 3) for ex in exercises)
    avg_rest = sum(ex.get("rest_seconds", 60) for ex in exercises) / len(exercises)
    set_time = 45  # seconds per set
    warmup_cooldown = 15  # minutes
    return int((total_sets * (set_time + avg_rest)) / 60 + warmup_cooldown)
