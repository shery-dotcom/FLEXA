from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.progress_service import ProgressService
from app.schemas.progress import ProgressLogCreate, ProgressLogResponse

router = APIRouter(prefix="/progress", tags=["Progress Visualization"])


@router.post("/log", response_model=ProgressLogResponse, status_code=201)
async def log_progress(
    data: ProgressLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log weight, BMI, and body composition data."""
    return await ProgressService.log_progress(db, current_user.id, data)


@router.get("/logs", response_model=List[ProgressLogResponse])
async def get_logs(
    limit: int = Query(90, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProgressService.get_logs(db, current_user.id, limit)


@router.get("/summary/weekly")
async def weekly_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProgressService.get_weekly_summary(db, current_user.id)


@router.get("/summary/monthly")
async def monthly_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ProgressService.get_monthly_summary(db, current_user.id)
