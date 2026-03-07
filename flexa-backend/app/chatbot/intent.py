"""
intent.py — Keyword-based intent classifier for FLEXOR.

Detects the primary intent of a user message so the engine can
tailor context retrieval and prompt framing.
"""
from __future__ import annotations
import re

# ─── Intent map (order matters — first match wins) ───────────────────────────

_PATTERNS: list[tuple[str, list[str]]] = [
    ("greeting",        [r"\b(hi|hello|hey|salam|assalam|السلام|ہیلو|سلام)\b"]),
    ("workout_plan",    [r"\b(workout|exercise|training|gym|train me|دورزش|ورزش|کسرت|وزرش)\b"]),
    ("diet_plan",       [r"\b(diet|meal plan|food plan|kha[ae]na|غذا|خوراک|کھانا)\b"]),
    ("nutrition",       [r"\b(calorie|protein|carb|fat|macro|nutrient|غذائیت|پروٹین)\b"]),
    ("weight_loss",     [r"\b(lose weight|weight loss|vajan kam|وزن کم|چربی)\b"]),
    ("weight_gain",     [r"\b(gain weight|bulk|muscle|وزن بڑھ|پٹھ)\b"]),
    ("bmi",             [r"\b(bmi|body mass|وزن اشاریہ)\b"]),
    ("progress",        [r"\b(progress|streak|report|رپورٹ|ترقی)\b"]),
    ("motivation",      [r"\b(motivat|inspir|tired|give up|ہمت|حوصلہ|تھک)\b"]),
    ("recipe",          [r"\b(recipe|cook|how to make|بنانا|ترکیب|سالن)\b"]),
    ("general_fitness", [r"\b(fit|health|wellness|صحت|تندرستی)\b"]),
]

_compiled = [(intent, [re.compile(p, re.IGNORECASE) for p in patterns])
             for intent, patterns in _PATTERNS]


def classify_intent(text: str) -> str:
    """Return the best-matching intent label, or 'general' if none match."""
    for intent, regexes in _compiled:
        for rx in regexes:
            if rx.search(text):
                return intent
    return "general"


def detect_language(text: str) -> str:
    """
    Fast script-based Urdu detector.
    Falls back to langdetect if ambiguous.
    """
    # Count Arabic/Urdu script characters
    urdu_chars = sum(1 for ch in text if "\u0600" <= ch <= "\u06FF" or "\u0750" <= ch <= "\u077F")
    if urdu_chars > 2:
        return "ur"

    # Try langdetect for edge cases
    try:
        from langdetect import detect
        lang = detect(text)
        return lang if lang in ("ur", "en") else "en"
    except Exception:
        return "en"
