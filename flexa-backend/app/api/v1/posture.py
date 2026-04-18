from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.posture import PostureSessionCreate, PostureSessionResponse
from app.services.posture_service import PostureService


router = APIRouter(prefix="/workout", tags=["Posture Tracking"])


@router.post("/session", response_model=PostureSessionResponse, status_code=201)
async def create_posture_session(
    data: PostureSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PostureService.create_session(db, current_user.id, data)


@router.get("/history", response_model=List[PostureSessionResponse])
async def get_posture_history(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PostureService.get_history(db, current_user.id, limit)
