from fastapi import APIRouter
from app.api.v1 import auth, users, goals, workouts, dashboard, progress, diet

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(users.router)
router.include_router(goals.router)
router.include_router(workouts.router)
router.include_router(dashboard.router)
router.include_router(progress.router)
router.include_router(diet.router)
