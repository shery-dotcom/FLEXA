"""
Flexa Workout Split Predictor
==============================
Loads the trained XGBoost model and predicts the recommended workout
split (Full Body / PPL / PPL x2 / Upper/Lower / Bro Split) from a
user's profile & goal data.

Field mappings from Flexa → Dataset:
  goal_type:
    "bulking"      → Bulking  (enc 2)
    "cutting"      → Cutting  (enc 0)
    "recomp"       → Maintaining (enc 1)
    "maintaining"  → Maintaining (enc 1)

  activity_level → experience encoding:
    "sedentary"  / "light"      → Beginner     (enc 0)  → frequency 2/3
    "moderate"                  → Intermediate  (enc 1)  → frequency 4
    "active"     / "very_active"→ Advanced      (enc 2)  → frequency 5/6

  gender:
    "male"   → Male   (enc 1)
    "female" → Female (enc 0)
    other    → Female (enc 0)  # safe default
"""

import os
import pickle
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
_ML_DIR = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH   = os.path.join(_ML_DIR, "workout_model.pkl")
_ENCODER_PATH = os.path.join(_ML_DIR, "workout_label_encoder.pkl")

# ── Lazy-load singleton ───────────────────────────────────────────────────────
_model = None
_label_enc = None


def _load_artifacts():
    global _model, _label_enc
    if _model is None:
        if not os.path.exists(_MODEL_PATH):
            raise FileNotFoundError(
                f"ML model not found at {_MODEL_PATH}. Run app/ml/train_model.py first."
            )
        with open(_MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        with open(_ENCODER_PATH, "rb") as f:
            _label_enc = pickle.load(f)
        logger.info("Workout ML model loaded successfully.")


# ── Encoding helpers ──────────────────────────────────────────────────────────
_GOAL_ENC = {
    "bulking":     2,
    "cutting":     0,
    "recomp":      1,
    "maintaining": 1,
}

_EXP_ENC = {
    "sedentary":   0,
    "light":       0,
    "moderate":    1,
    "active":      2,
    "very_active": 2,
}

_FREQ_FROM_ACTIVITY = {
    "sedentary":   2,
    "light":       3,
    "moderate":    4,
    "active":      5,
    "very_active": 6,
}

_GENDER_ENC = {
    "male":   1,
    "female": 0,
    "other":  0,
}


def _build_features(goal_lower: str, activity_lower: str, gender_lower: str, freq: int, user_age: float) -> np.ndarray:
    """
    Build the 18-feature vector that matches the training script's feature engineering.
    Feature order (must match train_model.py exactly):
      frequency, exp_enc, goal_enc, gender_enc, age,
      freq_x_exp, freq_x_goal, exp_x_goal,
      freq_sq, freq_bin, age_grp,
      goal_cut, goal_main, goal_bulk,
      exp_beg, exp_inter, exp_adv,
      effort
    """
    goal_enc   = float(_GOAL_ENC.get(goal_lower, 1))
    exp_enc    = float(_EXP_ENC.get(activity_lower, 1))
    gender_enc = float(_GENDER_ENC.get(gender_lower, 1))
    freq_f     = float(freq)
    age_f      = float(user_age)

    # interactions
    freq_x_exp  = freq_f * exp_enc
    freq_x_goal = freq_f * goal_enc
    exp_x_goal  = exp_enc * goal_enc

    # transformed
    freq_sq  = freq_f ** 2
    freq_bin = 0.0 if freq_f <= 3 else (1.0 if freq_f <= 5 else 2.0)
    age_grp  = 0.0 if age_f <= 25 else (1.0 if age_f <= 40 else 2.0)

    # one-hot goal
    goal_cut  = 1.0 if goal_enc == 0 else 0.0
    goal_main = 1.0 if goal_enc == 1 else 0.0
    goal_bulk = 1.0 if goal_enc == 2 else 0.0

    # one-hot experience
    exp_beg   = 1.0 if exp_enc == 0 else 0.0
    exp_inter = 1.0 if exp_enc == 1 else 0.0
    exp_adv   = 1.0 if exp_enc == 2 else 0.0

    # effort score
    effort = freq_f * (exp_enc + 1)

    return np.array([[
        freq_f, exp_enc, goal_enc, gender_enc, age_f,
        freq_x_exp, freq_x_goal, exp_x_goal,
        freq_sq, freq_bin, age_grp,
        goal_cut, goal_main, goal_bulk,
        exp_beg, exp_inter, exp_adv,
        effort,
    ]], dtype=float)


def predict_split(
    goal_type: str,
    activity_level: str,
    gender: str | None = None,
    age: int | None = None,
    frequency_override: int | None = None,
) -> str:
    """
    Predict the recommended workout split for a user.

    Parameters
    ----------
    goal_type        : Flexa goal_type  (bulking / cutting / recomp / maintaining)
    activity_level   : Flexa activity_level (sedentary / light / moderate / active / very_active)
    gender           : "male" | "female" | None  (defaults to "male" if unknown)
    age              : integer age in years (defaults to 25 if unknown)
    frequency_override: explicit workouts-per-week (2-6); if None, inferred from activity_level

    Returns
    -------
    str: one of {"Full Body", "PPL", "PPL x2", "Upper/Lower", "Bro Split"}
    """
    _load_artifacts()

    goal_lower     = (goal_type or "recomp").lower()
    activity_lower = (activity_level or "moderate").lower()
    gender_lower   = (gender or "male").lower()
    freq           = frequency_override or _FREQ_FROM_ACTIVITY.get(activity_lower, 4)
    user_age       = float(age) if age else 25.0

    features  = _build_features(goal_lower, activity_lower, gender_lower, freq, user_age)
    pred_idx  = _model.predict(features)[0]
    split     = _label_enc.inverse_transform([pred_idx])[0]

    logger.debug(
        "predict_split → goal=%s activity=%s freq=%d age=%s → %s",
        goal_lower, activity_lower, freq, user_age, split,
    )
    return split


def predict_split_with_proba(
    goal_type: str,
    activity_level: str,
    gender: str | None = None,
    age: int | None = None,
    frequency_override: int | None = None,
) -> dict:
    """
    Same as predict_split but also returns class probabilities.
    """
    _load_artifacts()

    goal_lower     = (goal_type or "recomp").lower()
    activity_lower = (activity_level or "moderate").lower()
    gender_lower   = (gender or "male").lower()
    freq           = frequency_override or _FREQ_FROM_ACTIVITY.get(activity_lower, 4)
    user_age       = float(age) if age else 25.0

    features  = _build_features(goal_lower, activity_lower, gender_lower, freq, user_age)
    pred_idx  = _model.predict(features)[0]
    probas    = _model.predict_proba(features)[0]
    split     = _label_enc.inverse_transform([pred_idx])[0]
    classes   = _label_enc.classes_

    return {
        "split":  split,
        "probas": {cls: round(float(p), 3) for cls, p in zip(classes, probas)},
    }
