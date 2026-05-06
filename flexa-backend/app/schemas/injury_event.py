from datetime import datetime
from pydantic import BaseModel, Field
import uuid


class InjuryEventCreate(BaseModel):
    session_id: uuid.UUID
    exercise: str = Field(..., min_length=1, max_length=80)
    injury_type: str = Field(..., min_length=1, max_length=80)
    severity: str = Field(..., min_length=1, max_length=20)
    recovery_advice: str = Field(..., min_length=1, max_length=500)


class InjuryEventResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    session_id: uuid.UUID
    exercise: str
    injury_type: str
    severity: str
    recovery_advice: str
    created_at: datetime

    class Config:
        from_attributes = True


class InjurySummary(BaseModel):
    injury_type: str
    severity: str
    count: int
    last_occurrence: datetime
