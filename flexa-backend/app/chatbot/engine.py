"""
engine.py — FLEXOR main orchestrator.

Flow:
  1. Detect language
  2. Classify intent
  3. Retrieve RAG context
  4. Fetch memory window
  5. Refresh avatar state (streak, BMI)
  6. Build prompt
  7. Call Groq LLM
  8. Persist messages
  9. Return reply + avatar event
"""
from __future__ import annotations
import os
import uuid
import asyncio
import logging
from datetime import date
from typing import Any

import groq as groq_sdk
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.user import User
from app.chatbot import avatar as avatar_mod
from app.chatbot import memory as memory_mod
from app.chatbot import rag as rag_mod
from app.chatbot.intent import classify_intent, detect_language
from app.chatbot.prompt_builder import build_messages
from app.schemas.chatbot import AvatarEvent, ChatMessageResponse

logger = logging.getLogger(__name__)

# llama-3.1-8b-instant is Groq's speed-optimised model — ~5-10× faster than
# the 70B while retaining strong fitness/nutrition reasoning quality.
_GROQ_MODEL = "llama-3.1-8b-instant"


def _get_api_key() -> str:
    api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured. Set it in flexa-backend/.env")
    return api_key


async def _get_user_profile(db: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    """Pull profile + active goal from DB."""
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.profile),
            selectinload(User.fitness_goals),
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return {}

    profile = user.profile
    if not profile:
        return {}

    # Get active goal
    goal_type = "general fitness"
    activity_level = "moderate"
    for g in (user.fitness_goals or []):
        if getattr(g, "is_active", True):
            goal_type = getattr(g, "goal_type", goal_type)
            activity_level = getattr(g, "activity_level", activity_level)
            break

    return {
        "username": getattr(profile, "username", None),
        "age": getattr(profile, "age", None),
        "gender": getattr(profile, "gender", None),
        "goal_type": goal_type,
        "activity_level": activity_level,
    }


async def process_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    user_message: str,
    language_hint: str | None = None,
) -> ChatMessageResponse:
    """Full FLEXOR pipeline. Returns formatted response."""

    # 1. Language detection
    language = language_hint or detect_language(user_message)

    # 2. Intent classification
    intent = classify_intent(user_message)

    # 3+4+5+6. Run RAG (CPU thread) + memory + avatar + profile in parallel.
    # RAG uses a background thread (no DB); memory/avatar/profile all use the
    # same AsyncSession but asyncio.gather interleaves their awaits safely
    # because SQLAlchemy async never holds the connection between awaits.
    # Top_k reduced from 5 to 3 for faster retrieval without quality loss.
    rag_context, history, avatar_state, user_profile = await asyncio.gather(
        asyncio.to_thread(rag_mod.retrieve, user_message, 3, intent),
        memory_mod.fetch_window(db, user_id),
        avatar_mod.refresh_avatar_from_progress(db, user_id),
        _get_user_profile(db, user_id),
    )

    # Compute days inactive
    days_inactive = 0
    if avatar_state.last_active_date:
        days_inactive = (date.today() - avatar_state.last_active_date).days

    avatar_dict = {
        "bmi": avatar_state.bmi,
        "bmi_category": avatar_state.bmi_category,
        "avatar_class": avatar_state.avatar_class,
        "streak_days": avatar_state.streak_days,
        "personality_mode": avatar_state.personality_mode,
    }

    # 7. Build prompt
    messages = build_messages(
        user_profile=user_profile,
        avatar=avatar_dict,
        rag_context=rag_context,
        history=history,
        user_message=user_message,
        language=language,
        days_inactive=days_inactive,
    )

    # 8. Groq LLM call — use AsyncGroq so the event loop isn't blocked
    try:
        async_client = groq_sdk.AsyncGroq(api_key=_get_api_key())
        completion = await async_client.chat.completions.create(
            model=_GROQ_MODEL,
            messages=messages,
            max_tokens=300,   # system prompt caps responses at 150 words
            temperature=0.72,
        )
        reply = completion.choices[0].message.content.strip()
        tokens_used = getattr(completion.usage, "completion_tokens", len(reply.split()))
    except groq_sdk.APIError as e:
        logger.error(f"Groq API error: {e}")
        if language == "ur":
            reply = "معذرت، میں ابھی جواب دینے میں قاصر ہوں۔ براہ کرم دوبارہ کوشش کریں۔"
        else:
            reply = "I'm having trouble responding right now. Please try again in a moment."
        tokens_used = 0

    # 9. Persist both messages
    await memory_mod.save_message(db, user_id, "user", user_message)
    await memory_mod.save_message(db, user_id, "assistant", reply, token_count=tokens_used)
    await db.commit()

    # 10. Build avatar event
    badge = avatar_mod.streak_badge(avatar_state.streak_days)
    animation = avatar_mod.resolve_animation(
        avatar_state.streak_days, avatar_state.last_active_date, badge
    )

    avatar_event = AvatarEvent(
        animation=animation,
        avatar_class=avatar_state.avatar_class,
        streak_days=avatar_state.streak_days,
        badge=badge,
        personality_mode=avatar_state.personality_mode,
    )

    from datetime import datetime, timezone
    return ChatMessageResponse(
        reply=reply,
        language=language,
        intent=intent,
        avatar_event=avatar_event,
        timestamp=datetime.now(timezone.utc),
    )
