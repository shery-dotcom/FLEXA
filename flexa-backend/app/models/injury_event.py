import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class InjuryEvent(Base):
    __tablename__ = "injury_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posture_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    injury_type: Mapped[str] = mapped_column(String(80), nullable=False)  # e.g., "back_not_straight"
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # "low", "medium", "high"
    recovery_advice: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user = relationship("User", backref="injury_events", lazy="noload")
    session = relationship("PostureSession", backref="injury_events", lazy="noload")
