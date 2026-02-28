from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class ExerciseItem(BaseModel):
    name: str
    sets: int
    reps: str
    rest_seconds: int
    muscle_group: str
    equipment: Optional[str] = "none"


class WorkoutResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    week_number: int
    day_of_week: str
    is_rest_day: bool
    exercises: Optional[List[Dict[str, Any]]]
    warmup: Optional[List[Dict[str, Any]]]
    cooldown: Optional[List[Dict[str, Any]]]
    duration_minutes: Optional[int]
    difficulty: Optional[str]
    ai_generated: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WorkoutPlanRequest(BaseModel):
    frequency_per_week: int  # 3, 4, 5, 6
    week_number: int = 1      # target week to generate


class WorkoutPlanResponse(BaseModel):
    week_number: int
    workouts: List[WorkoutResponse]


class WorkoutUpdateRequest(BaseModel):
    exercises: Optional[List[Dict[str, Any]]] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
