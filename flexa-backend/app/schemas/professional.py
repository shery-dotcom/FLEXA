from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class ProfessionalRegistrationRequest(BaseModel):
    """Request to register as a professional"""
    specialization: str = Field(..., description="nutritionist or fitness_trainer")
    location: Optional[str] = Field(None, max_length=150, description="Primary consultation location")
    bio: str = Field(..., min_length=50, max_length=1000, description="Professional bio")
    years_experience: int = Field(..., ge=0, le=60)
    certifications: List[str] = Field(..., description="List of certifications")
    languages: List[str] = Field(default=["English"])
    consultation_price_usd: float = Field(..., ge=25, le=500, description="Price per session")
    consultation_duration_mins: int = Field(default=60, description="Session duration")
    verification_document_url: Optional[str] = None
    timezone: str = Field(default="Asia/Karachi")


class ProfessionalProfileResponse(BaseModel):
    """Professional profile details"""
    id: str
    name: str
    specialization: str
    location: Optional[str]
    bio: str
    years_experience: int
    certifications: List[str]
    languages: List[str]
    consultation_price_usd: float
    consultation_duration_mins: int
    average_rating: Optional[float]
    total_reviews: int
    total_sessions_completed: int
    is_verified: bool
    timezone: str
    
    class Config:
        from_attributes = True


class AvailabilitySlotResponse(BaseModel):
    """Available time slot"""
    slot_id: str
    start_time: str  # ISO format
    end_time: str
    price_usd: Optional[float] = None


class ProfessionalDetailResponse(BaseModel):
    """Detailed professional profile with availability"""
    id: str
    name: str
    specialization: str
    location: Optional[str]
    bio: str
    years_experience: int
    certifications: List[str]
    languages: List[str]
    consultation_price_usd: float
    consultation_duration_mins: int
    average_rating: Optional[float]
    total_reviews: int
    total_sessions_completed: int
    is_verified: bool
    available_slots: List[AvailabilitySlotResponse]


class ProfessionalsSearchResponse(BaseModel):
    """Search results for professionals"""
    professionals: List[dict]
    total: int
    page: int
    page_size: int
    total_pages: int


class ConsultationBookingRequest(BaseModel):
    """Request to book a consultation"""
    specialization_type: str = Field(..., description="nutrition, fitness_training, or both")
    notes: Optional[str] = Field(None, max_length=500, description="Topics to discuss")


class ConsultationSessionResponse(BaseModel):
    """Consultation session details"""
    session_id: str
    professional_name: str
    professional_id: str
    specialization: str
    scheduled_at: str  # ISO format
    status: str
    price_paid_usd: float
    meeting_link: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class ConsultationUpcomingResponse(BaseModel):
    """Upcoming consultation for professional"""
    session_id: str
    user_name: str
    scheduled_at: str  # ISO format
    specialization_type: str
    meeting_link: Optional[str]
    user_notes: Optional[str]


class ProfessionalDashboardResponse(BaseModel):
    """Professional dashboard view"""
    profile: dict
    upcoming_sessions: List[ConsultationUpcomingResponse]
    stats: dict  # {sessions_this_month, earnings_this_month_usd, average_rating, etc}


class ReviewSubmissionRequest(BaseModel):
    """Request to submit a review"""
    rating: int = Field(..., ge=1, le=5)
    title: str = Field(..., min_length=5, max_length=100)
    content: str = Field(..., min_length=20, max_length=1000)


class ReviewResponse(BaseModel):
    """Professional review"""
    review_id: str
    rating: int
    title: str
    content: str
    user_name: str
    created_at: str
    helpful_count: int

    class Config:
        from_attributes = True


class PaymentConfirmationRequest(BaseModel):
    """Request to confirm payment"""
    meeting_link: Optional[str] = Field(default=None, description="Zoom/Google Meet link")


class SessionCancellationRequest(BaseModel):
    """Request to cancel a session"""
    reason: Optional[str] = Field(None, max_length=500)
