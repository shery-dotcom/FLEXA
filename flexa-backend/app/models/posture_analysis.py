import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class PostureAnalysis(Base):
    """Detailed analysis of a posture session with rep-by-rep breakdown"""
    __tablename__ = "posture_analysis"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posture_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Summary stats
    total_reps: Mapped[int] = mapped_column(Integer, default=0)
    perfect_reps: Mapped[int] = mapped_column(Integer, default=0)
    good_reps: Mapped[int] = mapped_column(Integer, default=0)
    poor_reps: Mapped[int] = mapped_column(Integer, default=0)
    
    # Scores (0-100)
    overall_form_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-100
    consistency_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-100
    
    # Common issues found
    common_issues: Mapped[list] = mapped_column(JSON, default=[])  # List of identified issues
    
    # Detailed feedback
    summary_feedback: Mapped[str] = mapped_column(String(1000), nullable=True)
    improvement_tips: Mapped[list] = mapped_column(JSON, default=[])  # List of actionable tips
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    session = relationship("PostureSession", backref="analysis", lazy="noload")
    user = relationship("User", backref="posture_analyses", lazy="noload")
