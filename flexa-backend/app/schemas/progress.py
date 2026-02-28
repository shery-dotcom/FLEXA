from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import uuid


class ProgressLogCreate(BaseModel):
    log_date: date
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None


class ProgressLogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    log_date: date
    weight_kg: Optional[float]
    bmi: Optional[float]
    body_fat_pct: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WeeklySummaryResponse(BaseModel):
    week_start: date
    week_end: date
    avg_weight: Optional[float]
    avg_bmi: Optional[float]
    sessions_completed: int
    logs_count: int


class MilestoneResponse(BaseModel):
    title: str
    description: str
    achieved_at: Optional[datetime]
    milestone_type: str


class DashboardTaskResponse(BaseModel):
    id: uuid.UUID
    task_date: date
    title: str
    description: Optional[str]
    task_type: str
    is_completed: bool
    priority: int

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    user_name: str
    bmi: Optional[float]
    bmi_category: Optional[str]
    current_goal: Optional[str]
    motivation_message: str
    motivation_score: float
    today_tasks: List[DashboardTaskResponse]
    milestones: List[MilestoneResponse]
    weekly_sessions: int
    total_workouts_completed: int
