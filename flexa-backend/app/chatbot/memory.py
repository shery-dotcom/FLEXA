"""
memory.py — Chat memory management for FLEXA.

Strategy:
  • Sliding window: always include last 8 messages from chat_memory
  • Summarization: every 20 messages, Groq summarizes older history
    → stored as a single `system` role row, replacing older messages
  • Redis session cache: hot window cached for 2hr per user
"""
from __future__ import annotations
import json
import uuid
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from app.models.chatbot import ChatMemory

logger = logging.getLogger(__name__)

WINDOW_SIZE = 8
SUMMARIZE_EVERY = 20
CACHE_TTL = 7200  # 2 hours


# ─── Redis helpers ────────────────────────────────────────────────────────────

def _cache_key(user_id: uuid.UUID) -> str:
    return f"flexa:session:{user_id}"


async def _get_redis():
    try:
        from app.core.cache import get_redis
        return await get_redis()
    except Exception:
        return None


# ─── Fetch window ─────────────────────────────────────────────────────────────

async def fetch_window(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """Return last WINDOW_SIZE messages as list of {role, content} dicts."""
    # Try Redis cache first
    redis = await _get_redis()
    if redis:
        try:
            cached = await redis.get(_cache_key(user_id))
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    result = await db.execute(
        select(ChatMemory)
        .where(ChatMemory.user_id == user_id)
        .order_by(ChatMemory.created_at.desc())
        .limit(WINDOW_SIZE)
    )
    rows = result.scalars().all()
    rows = list(reversed(rows))  # chronological order
    window = [{"role": r.role, "content": r.content} for r in rows]

    # Cache result
    if redis:
        try:
            await redis.setex(_cache_key(user_id), CACHE_TTL, json.dumps(window))
        except Exception:
            pass

    return window


# ─── Save message ─────────────────────────────────────────────────────────────

async def save_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    role: str,
    content: str,
    token_count: int = 0,
) -> None:
    """Persist a message and invalidate Redis cache."""
    msg = ChatMemory(
        user_id=user_id,
        role=role,
        content=content,
        token_count=token_count,
    )
    db.add(msg)
    await db.flush()

    # Invalidate cache
    redis = await _get_redis()
    if redis:
        try:
            await redis.delete(_cache_key(user_id))
        except Exception:
            pass

    # Check if summarization needed
    await _maybe_summarize(db, user_id)


# ─── Summarization ────────────────────────────────────────────────────────────

async def _maybe_summarize(db: AsyncSession, user_id: uuid.UUID) -> None:
    """If message count ≥ SUMMARIZE_EVERY, summarize old messages with Groq."""
    count_result = await db.execute(
        select(func.count(ChatMemory.id))
        .where(ChatMemory.user_id == user_id)
        .where(ChatMemory.role != "system")
    )
    total = count_result.scalar() or 0

    if total < SUMMARIZE_EVERY:
        return

    # Fetch messages to summarize (all but last WINDOW_SIZE)
    result = await db.execute(
        select(ChatMemory)
        .where(ChatMemory.user_id == user_id)
        .where(ChatMemory.role != "system")
        .order_by(ChatMemory.created_at.asc())
        .limit(total - WINDOW_SIZE)
    )
    old_rows = result.scalars().all()
    if not old_rows:
        return

    conversation_text = "\n".join(
        f"{r.role.upper()}: {r.content}" for r in old_rows
    )

    try:
        import groq as groq_sdk
        import os
        client = groq_sdk.Groq(api_key=os.getenv("GROQ_API_KEY"))
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "Summarize the following fitness conversation in 3-4 sentences. Keep key user goals, preferences, and progress.",
                },
                {"role": "user", "content": conversation_text},
            ],
            max_tokens=300,
        )
        summary = resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        return

    # Delete old rows + insert summary
    old_ids = [r.id for r in old_rows]
    await db.execute(
        delete(ChatMemory).where(ChatMemory.id.in_(old_ids))
    )
    summary_row = ChatMemory(
        user_id=user_id,
        role="system",
        content=f"[Conversation summary]: {summary}",
        token_count=len(summary.split()),
    )
    db.add(summary_row)
    await db.flush()
    logger.info(f"Summarized {len(old_ids)} messages for user {user_id}")


# ─── Clear history ────────────────────────────────────────────────────────────

async def clear_history(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(ChatMemory).where(ChatMemory.user_id == user_id))
    redis = await _get_redis()
    if redis:
        try:
            await redis.delete(_cache_key(user_id))
        except Exception:
            pass
