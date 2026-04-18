import uuid
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.posture import PostureSession
from app.schemas.posture import PostureSessionCreate


class PostureService:

    @staticmethod
    async def create_session(
        db: AsyncSession,
        user_id: uuid.UUID,
        data: PostureSessionCreate,
    ) -> PostureSession:
        session = PostureSession(
            user_id=user_id,
            exercise=data.exercise.strip().lower(),
            reps=data.reps,
            duration=data.duration,
            posture_score=data.posture_score,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def get_history(
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 50,
    ) -> List[PostureSession]:
        result = await db.execute(
            select(PostureSession)
            .where(PostureSession.user_id == user_id)
            .order_by(PostureSession.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
