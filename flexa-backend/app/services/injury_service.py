import uuid
from typing import List
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.injury_event import InjuryEvent
from app.schemas.injury_event import InjuryEventCreate, InjurySummary


class InjuryService:

    @staticmethod
    async def log_event(
        db: AsyncSession,
        user_id: uuid.UUID,
        data: InjuryEventCreate,
    ) -> InjuryEvent:
        """Log a single injury event during a workout session"""
        event = InjuryEvent(
            user_id=user_id,
            session_id=data.session_id,
            exercise=data.exercise.strip().lower(),
            injury_type=data.injury_type.strip().lower(),
            severity=data.severity.strip().lower(),
            recovery_advice=data.recovery_advice.strip(),
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event

    @staticmethod
    async def get_history(
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 50,
    ) -> List[InjuryEvent]:
        """Get all injury events for a user"""
        result = await db.execute(
            select(InjuryEvent)
            .where(InjuryEvent.user_id == user_id)
            .order_by(InjuryEvent.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def get_injury_summary(
        db: AsyncSession,
        user_id: uuid.UUID,
        days: int = 30,
    ) -> List[InjurySummary]:
        """Get injury summary for last N days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await db.execute(
            select(
                InjuryEvent.injury_type,
                InjuryEvent.severity,
                func.count(InjuryEvent.id).label("count"),
                func.max(InjuryEvent.created_at).label("last_occurrence"),
            )
            .where(
                InjuryEvent.user_id == user_id,
                InjuryEvent.created_at >= cutoff_date,
            )
            .group_by(InjuryEvent.injury_type, InjuryEvent.severity)
            .order_by(func.count(InjuryEvent.id).desc())
        )
        
        rows = result.all()
        return [
            InjurySummary(
                injury_type=row[0],
                severity=row[1],
                count=row[2],
                last_occurrence=row[3],
            )
            for row in rows
        ]

    @staticmethod
    async def get_by_exercise(
        db: AsyncSession,
        user_id: uuid.UUID,
        exercise: str,
        limit: int = 20,
    ) -> List[InjuryEvent]:
        """Get injury events for a specific exercise"""
        result = await db.execute(
            select(InjuryEvent)
            .where(
                InjuryEvent.user_id == user_id,
                InjuryEvent.exercise == exercise.strip().lower(),
            )
            .order_by(InjuryEvent.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
