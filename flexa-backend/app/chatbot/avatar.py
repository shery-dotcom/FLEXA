"""
avatar.py — BMI-to-avatar class mapper, streak tracker, badge detector.
"""
from __future__ import annotations
from datetime import date, timedelta
from typing import Optional
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.chatbot import AvatarState
from app.models.progress import ProgressLog


# ─── BMI Thresholds ───────────────────────────────────────────────────────────

def bmi_to_class(bmi: float) -> tuple[str, str, str]:
    """Return (avatar_class, bmi_category, personality_mode)."""
    if bmi < 18.5:
        return "slim", "Underweight", "motivator"
    elif bmi < 25.0:
        return "fit", "Normal weight", "coach"
    elif bmi < 30.0:
        return "athletic", "Overweight", "coach"
    elif bmi < 35.0:
        return "heavy", "Obese class I", "motivator"
    else:
        return "heavy_plus", "Obese class II+", "motivator"


# ─── Badge Detection ──────────────────────────────────────────────────────────

def streak_badge(streak_days: int) -> Optional[str]:
    if streak_days >= 30:
        return "trophy"
    elif streak_days >= 7:
        return "flame"
    elif streak_days >= 3:
        return "gold_ring"
    return None


# ─── Animation ────────────────────────────────────────────────────────────────

def resolve_animation(streak_days: int, last_active: Optional[date], badge: Optional[str]) -> str:
    """Return animation state: celebrate | sleep | idle."""
    if badge:
        return "celebrate"
    if last_active:
        days_inactive = (date.today() - last_active).days
        if days_inactive >= 3:
            return "sleep"
    return "idle"


# ─── DB helpers ───────────────────────────────────────────────────────────────

async def get_or_create_avatar(db: AsyncSession, user_id: uuid.UUID) -> AvatarState:
    result = await db.execute(
        select(AvatarState).where(AvatarState.user_id == user_id)
    )
    avatar = result.scalar_one_or_none()
    if avatar is None:
        avatar = AvatarState(user_id=user_id)
        db.add(avatar)
        await db.flush()
    return avatar


async def refresh_avatar_from_progress(db: AsyncSession, user_id: uuid.UUID) -> AvatarState:
    """Read latest ProgressLog → update AvatarState."""
    # Get latest progress log
    result = await db.execute(
        select(ProgressLog)
        .where(ProgressLog.user_id == user_id)
        .order_by(ProgressLog.log_date.desc())
        .limit(1)
    )
    log = result.scalar_one_or_none()

    avatar = await get_or_create_avatar(db, user_id)
    today = date.today()

    if log and log.bmi:
        avatar_class, bmi_category, personality = bmi_to_class(log.bmi)
        avatar.bmi = log.bmi
        avatar.bmi_category = bmi_category
        avatar.avatar_class = avatar_class
        avatar.personality_mode = personality

    # Streak logic
    if avatar.last_active_date:
        delta = (today - avatar.last_active_date).days
        if delta == 1:
            avatar.streak_days += 1
        elif delta == 0:
            pass  # already counted today
        else:
            avatar.streak_days = 1  # reset
    else:
        avatar.streak_days = 1

    avatar.last_active_date = today
    await db.flush()
    return avatar
