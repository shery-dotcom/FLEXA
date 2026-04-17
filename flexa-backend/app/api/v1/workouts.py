from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.workout import FitnessGoal
from app.models.profile import Profile
from app.services.workout_service import WorkoutService
from app.schemas.workout import WorkoutPlanRequest, WorkoutResponse, WorkoutCompleteRequest
from app.ml.workout_ml_predictor import predict_split_with_proba
import uuid

router = APIRouter(prefix="/workouts", tags=["Workout Planner"])


@router.get("/my-split")
async def get_my_predicted_split(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the ML-predicted workout split for the current user based on
    their active goal and profile data.
    """
    profile_res = await db.execute(select(Profile).where(Profile.user_id == current_user.id))
    profile = profile_res.scalar_one_or_none()

    goal_res = await db.execute(
        select(FitnessGoal).where(
            FitnessGoal.user_id == current_user.id,
            FitnessGoal.is_active == True,
        )
    )
    goal = goal_res.scalar_one_or_none()

    if not profile or not goal:
        return {"split": None, "probas": {}, "message": "Complete profile and goal setup first."}

    result = predict_split_with_proba(
        goal_type=goal.goal_type,
        activity_level=goal.activity_level,
        gender=profile.gender,
        age=profile.age,
    )
    return result


@router.post("/generate", response_model=List[WorkoutResponse], status_code=201)
async def generate_workout_plan(
    data: WorkoutPlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI generates a personalized weekly workout plan based on goal, BMI, and activity level."""
    return await WorkoutService.generate_and_save_plan(db, current_user.id, data)


@router.get("/", response_model=List[WorkoutResponse])
async def get_my_workouts(
    week: int = Query(1, ge=1, le=52),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WorkoutService.get_user_workouts(db, current_user.id, week)


@router.post("/{workout_id}/complete")
async def complete_workout(
    workout_id: uuid.UUID,
    body: WorkoutCompleteRequest = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a workout as completed and log the session with exercise data."""
    session = await WorkoutService.complete_workout_session(
        db, current_user.id, workout_id,
        sets_data=body.sets_data if body else None,
        session_duration_seconds=body.session_duration_seconds if body else None,
        notes=body.notes if body else None,
    )
    return {"message": "Workout session logged successfully!", "session_id": str(session.id)}
