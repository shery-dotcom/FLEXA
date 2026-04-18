"""
prompt_builder.py — Assembles the full prompt for FLEXA's Groq call.

Combines: system persona + user profile + RAG context + memory window + user message.
"""
from __future__ import annotations
from typing import Any, Optional


_SYSTEM_TEMPLATE = """You are FLEXA — FLEXA's AI fitness companion. You are warm, motivating, and knowledgeable.

PERSONALITY: {personality_mode}
USER PROFILE:
  Name: {name} | Age: {age} | Gender: {gender}
  Goal: {goal_type} | Activity: {activity_level}
  BMI: {bmi} ({bmi_category}) | Avatar: {avatar_class}
  Streak: {streak_days} days

RULES:
1. Respond in the SAME language as the user message ({language}).
2. Be concise (under 150 words) unless the user asks for a full plan.
3. Personalize advice to the user's BMI, goal, and activity level.
4. Prefer Pakistani food examples (dal, roti, biryani, chicken karahi, etc.) when suggesting meals.
5. Never diagnose medical conditions. Recommend consulting a doctor for medical issues.
6. If streak_days >= 3, acknowledge their consistency briefly.
7. If last active > 3 days ago, warmly encourage them to get back on track.
8. In Urdu responses, keep fitness terms (protein, calories, BMI) in English for clarity.
9. Do NOT repeat the user's question back to them.
10. coach mode: structured, data-driven; motivator mode: enthusiastic, supportive.
"""

_INACTIVE_NOTE = "\n[Note: User has been inactive for {days} days. Start with a warm welcome-back message.]\n"


def build_messages(
    *,
    user_profile: dict[str, Any],
    avatar: dict[str, Any],
    rag_context: str,
    history: list[dict[str, str]],
    user_message: str,
    language: str,
    days_inactive: int = 0,
) -> list[dict[str, str]]:
    """
    Build the messages array for groq.chat.completions.create().

    Args:
        user_profile: dict with name, age, gender, goal_type, activity_level
        avatar: dict with bmi, bmi_category, avatar_class, streak_days, personality_mode
        rag_context: retrieved text from FAISS
        history: list of {"role": ..., "content": ...} from memory window
        user_message: the raw user input
        language: "en" | "ur"
        days_inactive: days since last active (triggers warm nudge)

    Returns:
        Messages list ready for Groq API.
    """
    name = user_profile.get("username") or user_profile.get("name") or "friend"
    age = user_profile.get("age") or "–"
    gender = user_profile.get("gender") or "–"
    goal_type = user_profile.get("goal_type") or "general fitness"
    activity_level = user_profile.get("activity_level") or "moderate"

    bmi = avatar.get("bmi") or "–"
    bmi_category = avatar.get("bmi_category") or "fit"
    avatar_class = avatar.get("avatar_class") or "fit"
    streak_days = avatar.get("streak_days") or 0
    personality_mode = avatar.get("personality_mode") or "coach"

    system_content = _SYSTEM_TEMPLATE.format(
        personality_mode=personality_mode,
        name=name,
        age=age,
        gender=gender,
        goal_type=goal_type,
        activity_level=activity_level,
        bmi=bmi,
        bmi_category=bmi_category,
        avatar_class=avatar_class,
        streak_days=streak_days,
        language="Urdu" if language == "ur" else "English",
    )

    if days_inactive >= 3:
        system_content += _INACTIVE_NOTE.format(days=days_inactive)

    if rag_context:
        system_content += f"\n\nRELEVANT KNOWLEDGE BASE:\n{rag_context}"

    messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]

    # Add conversation history (exclude system summaries — they're already baked in above)
    for h in history:
        if h["role"] in ("user", "assistant"):
            messages.append({"role": h["role"], "content": h["content"]})
        elif h["role"] == "system":
            # Inject summary as a system note
            messages.append({"role": "system", "content": h["content"]})

    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    return messages
