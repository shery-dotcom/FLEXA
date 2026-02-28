from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.goal_service import GoalService
from app.schemas.goal import GoalCreate, GoalResponse

router = APIRouter(prefix="/goals", tags=["Goals & AI Assessment"])


@router.post("/", response_model=GoalResponse, status_code=201)
async def create_goal(
    data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set fitness goal. AI validates the goal against BMI and generates health report."""
    return await GoalService.create_goal(db, current_user.id, data)


@router.get("/active", response_model=GoalResponse)
async def get_active_goal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await GoalService.get_active_goal(db, current_user.id)


@router.get("/", response_model=List[GoalResponse])
async def get_all_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await GoalService.get_all_goals(db, current_user.id)
