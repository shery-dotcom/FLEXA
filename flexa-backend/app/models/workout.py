import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, func, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class FitnessGoal(Base):
    __tablename__ = "fitness_goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_type: Mapped[str] = mapped_column(String(50), nullable=False)  # bulking, cutting, recomp
    activity_level: Mapped[str] = mapped_column(String(50), nullable=False)  # sedentary, light, moderate, active, very_active
    target_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ml_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="fitness_goals")


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    day_of_week: Mapped[str] = mapped_column(String(20), nullable=False)  # Monday, Tuesday...
    is_rest_day: Mapped[bool] = mapped_column(Boolean, default=False)
    exercises: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # list of exercise objects
    warmup: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    cooldown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="workouts")
    sessions: Mapped[list["WorkoutSession"]] = relationship("WorkoutSession", back_populates="workout", cascade="all, delete-orphan")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workout_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sets_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {exercise_index: [{weight, reps, done}]}

    workout: Mapped["Workout"] = relationship("Workout", back_populates="sessions")
