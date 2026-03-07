from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.chatbot import ChatMemory, AvatarState
from app.chatbot import engine, avatar as avatar_mod
from app.schemas.chatbot import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatHistoryResponse,
    ChatHistoryItem,
    AvatarStateResponse,
)

router = APIRouter(prefix="/chatbot", tags=["FLEXOR Chatbot"])


# ─── Send Message ─────────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    body: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message to FLEXOR.
    Returns AI reply + avatar animation event.
    Supports Urdu and English.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(body.message) > 2000:
        raise HTTPException(status_code=400, detail="Message too long (max 2000 characters).")

    return await engine.process_message(
        db=db,
        user_id=current_user.id,
        user_message=body.message.strip(),
        language_hint=body.language,
    )


# ─── Get History ──────────────────────────────────────────────────────────────

@router.get("/history", response_model=ChatHistoryResponse)
async def get_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve chat history (most recent first)."""
    result = await db.execute(
        select(ChatMemory)
        .where(ChatMemory.user_id == current_user.id)
        .where(ChatMemory.role != "system")  # hide internal summaries
        .order_by(ChatMemory.created_at.desc())
        .limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    return ChatHistoryResponse(
        messages=[ChatHistoryItem.model_validate(r) for r in rows],
        total=len(rows),
    )


# ─── Clear History ────────────────────────────────────────────────────────────

@router.delete("/history", status_code=204)
async def clear_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all chat messages for the current user."""
    from app.chatbot.memory import clear_history as _clear
    await _clear(db, current_user.id)
    await db.commit()


# ─── Get Avatar State ─────────────────────────────────────────────────────────

@router.get("/avatar", response_model=AvatarStateResponse)
async def get_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current FLEXOR avatar state for the user."""
    avatar = await avatar_mod.get_or_create_avatar(db, current_user.id)
    await db.commit()
    return AvatarStateResponse.model_validate(avatar)


# ─── Refresh Avatar ───────────────────────────────────────────────────────────

@router.post("/avatar/refresh", response_model=AvatarStateResponse)
async def refresh_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recalculate avatar state from the latest progress log (BMI, streak)."""
    avatar = await avatar_mod.refresh_avatar_from_progress(db, current_user.id)
    await db.commit()
    return AvatarStateResponse.model_validate(avatar)
