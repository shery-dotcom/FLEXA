from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.injury_event import InjuryEventCreate, InjuryEventResponse, InjurySummary
from app.services.injury_service import InjuryService


router = APIRouter(prefix="/injuries", tags=["Injury Tracking"])


@router.post("/log", response_model=InjuryEventResponse, status_code=201)
async def log_injury_event(
    data: InjuryEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log an injury event during a workout session"""
    return await InjuryService.log_event(db, current_user.id, data)


@router.get("/history", response_model=List[InjuryEventResponse])
async def get_injury_history(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all injury events for the current user"""
    return await InjuryService.get_history(db, current_user.id, limit)


@router.get("/summary", response_model=List[InjurySummary])
async def get_injury_summary(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get injury summary for the last N days"""
    return await InjuryService.get_injury_summary(db, current_user.id, days)


@router.get("/exercise/{exercise}", response_model=List[InjuryEventResponse])
async def get_injuries_by_exercise(
    exercise: str,
    limit: int = Query(20, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get injury events for a specific exercise"""
    return await InjuryService.get_by_exercise(db, current_user.id, exercise, limit)
