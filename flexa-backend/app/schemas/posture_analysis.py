from datetime import datetime
from pydantic import BaseModel, Field
import uuid
from typing import List, Optional


class PostureRepAnalysis(BaseModel):
    """Analysis for a single rep"""
    rep_number: int
    form_quality: str = Field(..., description="perfect|good|poor")
    form_score: int = Field(..., ge=0, le=100)
    issues: List[str] = []
    feedback: Optional[str] = None


class PostureSessionAnalysisCreate(BaseModel):
    """Input for creating a posture analysis"""
    session_id: uuid.UUID
    total_reps: int
    perfect_reps: int
    good_reps: int
    poor_reps: int
    overall_form_score: int = Field(..., ge=0, le=100)
    consistency_score: int = Field(..., ge=0, le=100)
    common_issues: List[str] = []
    summary_feedback: Optional[str] = None
    improvement_tips: List[str] = []


class PostureSessionAnalysisResponse(BaseModel):
    """Response for posture analysis"""
    id: uuid.UUID
    session_id: uuid.UUID
    user_id: uuid.UUID
    
    # Summary stats
    total_reps: int
    perfect_reps: int
    good_reps: int
    poor_reps: int
    
    perfect_percentage: float  # Calculated field
    
    # Scores
    overall_form_score: int
    consistency_score: int
    
    # Issues and feedback
    common_issues: List[str]
    summary_feedback: Optional[str]
    improvement_tips: List[str]
    
    created_at: datetime

    class Config:
        from_attributes = True
    
    @property
    def perfect_percentage(self) -> float:
        if self.total_reps == 0:
            return 0
        return round((self.perfect_reps / self.total_reps) * 100, 1)


class PostureSessionWithAnalysisResponse(BaseModel):
    """Response combining session and analysis"""
    session_id: uuid.UUID
    exercise: str
    duration: int
    
    # Analysis summary
    total_reps: int
    perfect_reps: int
    good_reps: int
    poor_reps: int
    
    form_score: int
    consistency_score: int
    
    common_issues: List[str]
    summary_feedback: Optional[str]
    improvement_tips: List[str]

    class Config:
        from_attributes = True
