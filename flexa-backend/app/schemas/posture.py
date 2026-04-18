from datetime import datetime
from pydantic import BaseModel, Field
import uuid


class PostureSessionCreate(BaseModel):
    exercise: str = Field(..., min_length=1, max_length=80)
    reps: int = Field(..., ge=0, le=1000)
    duration: int = Field(..., ge=1, le=60_000)
    posture_score: int = Field(..., ge=0, le=100)


class PostureSessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    exercise: str
    reps: int
    duration: int
    posture_score: int
    created_at: datetime

    class Config:
        from_attributes = True
