from datetime import datetime, date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


# ─── Request ──────────────────────────────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    message: str
    language: Optional[str] = None  # "en" | "ur" — auto-detected if None


# ─── Response ─────────────────────────────────────────────────────────────────

class AvatarEvent(BaseModel):
    animation: str           # "idle" | "celebrate" | "sleep"
    avatar_class: str        # "slim" | "fit" | "athletic" | "heavy" | "heavy_plus"
    streak_days: int
    badge: Optional[str]     # "gold_ring" | "flame" | "trophy" | None
    personality_mode: str    # "coach" | "motivator"


class ChatMessageResponse(BaseModel):
    reply: str
    language: str
    intent: str
    avatar_event: AvatarEvent
    timestamp: datetime


# ─── History ──────────────────────────────────────────────────────────────────

class ChatHistoryItem(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    messages: list[ChatHistoryItem]
    total: int


# ─── Avatar ───────────────────────────────────────────────────────────────────

class AvatarStateResponse(BaseModel):
    bmi: Optional[float]
    bmi_category: str
    avatar_class: str
    streak_days: int
    last_active_date: Optional[date]
    personality_mode: str
    updated_at: datetime

    class Config:
        from_attributes = True
