from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.dashboard_service import DashboardService
from app.schemas.progress import DashboardResponse
from app.core.cache import cache_get, cache_set, cache_delete
import uuid

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

_CACHE_TTL_DASHBOARD = 60  # seconds


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Central dashboard with motivation engine, milestones, and daily tasks.

    Result is cached in Redis for 60 s to reduce DB load on frequent polling.
    Cache is invalidated when tasks are completed.
    """
    cache_key = f"dashboard:{current_user.id}"

    cached = await cache_get(cache_key)
    if cached is not None:
        return DashboardResponse(**cached)

    # Service returns a plain dict; wrap in schema before caching / returning
    data = await DashboardService.get_dashboard(db, current_user.id)
    response = DashboardResponse(**data)
    await cache_set(cache_key, response.model_dump(mode="json"), ttl=_CACHE_TTL_DASHBOARD)
    return response


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await DashboardService.complete_task(db, current_user.id, task_id)
    # Invalidate dashboard cache so the next GET shows the updated task list
    await cache_delete(f"dashboard:{current_user.id}")
    return {"message": "Task completed!", "task_id": str(task.id)}
