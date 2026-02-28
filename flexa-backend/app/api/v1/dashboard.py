from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.dashboard_service import DashboardService
from app.schemas.progress import DashboardResponse
import uuid

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Central dashboard with motivation engine, milestones, and daily tasks."""
    return await DashboardService.get_dashboard(db, current_user.id)


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await DashboardService.complete_task(db, current_user.id, task_id)
    return {"message": "Task completed!", "task_id": str(task.id)}
