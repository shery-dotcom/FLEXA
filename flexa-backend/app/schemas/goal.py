from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime
import uuid


class GoalCreate(BaseModel):
    goal_type: str  # bulking, cutting, recomp
    activity_level: str  # sedentary, light, moderate, active, very_active
    target_weight_kg: Optional[float] = None


class GoalResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    goal_type: str
    activity_level: str
    target_weight_kg: Optional[float]
    target_bmi: Optional[float]
    ai_report: Optional[Dict[str, Any]]
    ml_score: Optional[float]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
