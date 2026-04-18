import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class PostureSession(Base):
    __tablename__ = "posture_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)  # seconds
    posture_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0..100
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user = relationship("User", backref="posture_sessions", lazy="noload")
