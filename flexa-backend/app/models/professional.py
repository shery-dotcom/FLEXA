import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, func, Enum, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ConsultationSessionStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class ProfessionalProfile(Base):
    __tablename__ = "professional_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Profile Info
    specialization: Mapped[str] = mapped_column(String(50), nullable=False)  # "nutritionist", "fitness_trainer", "both"
    bio: Mapped[str] = mapped_column(Text, nullable=False)
    years_experience: Mapped[int] = mapped_column(Integer, nullable=False)
    certifications: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array stored as string
    languages: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array

    # Verification & Trust
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_document_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Pricing
    consultation_price_usd: Mapped[float] = mapped_column(Float, nullable=False)  # $50-$150
    consultation_duration_mins: Mapped[int] = mapped_column(Integer, nullable=False)  # 30, 45, 60

    # Rating & Reviews
    average_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    total_sessions_completed: Mapped[int] = mapped_column(Integer, default=0)

    # Availability & Capacity
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Karachi")
    is_accepting_clients: Mapped[bool] = mapped_column(Boolean, default=True)
    max_clients_per_week: Mapped[int] = mapped_column(Integer, default=10)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="professional_profile")
    sessions: Mapped[list["ConsultationSession"]] = relationship("ConsultationSession", back_populates="professional", cascade="all, delete-orphan")
    availability_slots: Mapped[list["AvailabilitySlot"]] = relationship("AvailabilitySlot", back_populates="professional", cascade="all, delete-orphan")
    reviews: Mapped[list["ProfessionalReview"]] = relationship("ProfessionalReview", back_populates="professional", cascade="all, delete-orphan")


class ConsultationSession(Base):
    __tablename__ = "consultation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Participants
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("professional_profiles.id", ondelete="CASCADE"), nullable=False)

    # Session Details
    specialization_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "nutrition", "fitness_training", "both"
    session_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_mins: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=ConsultationSessionStatus.PENDING)

    # Pricing & Commission
    session_price_usd: Mapped[float] = mapped_column(Float, nullable=False)
    professional_earnings_usd: Mapped[float] = mapped_column(Float, nullable=False)
    flexa_commission_usd: Mapped[float] = mapped_column(Float, nullable=False)
    commission_rate: Mapped[float] = mapped_column(Float, default=0.25)  # 25% default

    # Session Content
    meeting_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Payment & Transaction
    payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), default=PaymentStatus.PENDING)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="consultation_sessions")
    professional: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="sessions")
    payment: Mapped["Payment"] = relationship("Payment", back_populates="session", uselist=False, cascade="all, delete-orphan")
    review: Mapped["ProfessionalReview"] = relationship("ProfessionalReview", back_populates="session", uselist=False, cascade="all, delete-orphan")


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("professional_profiles.id", ondelete="CASCADE"), nullable=False)

    # Time Info
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    booked_session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("consultation_sessions.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    professional: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="availability_slots")


class ProfessionalReview(Base):
    __tablename__ = "professional_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consultation_sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("professional_profiles.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Review Content
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Helpfulness
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ConsultationSession"] = relationship("ConsultationSession", back_populates="review")
    professional: Mapped["ProfessionalProfile"] = relationship("ProfessionalProfile", back_populates="reviews")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Transaction Info
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consultation_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    professional_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("professional_profiles.id", ondelete="CASCADE"), nullable=False)

    # Stripe Integration
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Amount Breakdown
    gross_amount_usd: Mapped[float] = mapped_column(Float, nullable=False)
    flexa_commission_usd: Mapped[float] = mapped_column(Float, nullable=False)
    professional_payout_usd: Mapped[float] = mapped_column(Float, nullable=False)

    # Status
    payment_status: Mapped[str] = mapped_column(String(20), default=PaymentStatus.PENDING)
    payout_status: Mapped[str] = mapped_column(String(20), default="pending")

    # Refund Info
    refund_amount_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    refund_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["ConsultationSession"] = relationship("ConsultationSession", back_populates="payment")
