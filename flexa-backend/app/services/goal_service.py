from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.workout import FitnessGoal
from app.models.profile import Profile
from app.schemas.goal import GoalCreate, GoalResponse
from app.ml.bmi_validator import validate_goal_against_bmi, calculate_bmi
import uuid


class GoalService:

    @staticmethod
    async def create_goal(db: AsyncSession, user_id: uuid.UUID, data: GoalCreate) -> FitnessGoal:
        # Get user profile for BMI
        result = await db.execute(select(Profile).where(Profile.user_id == user_id))
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(status_code=400, detail="Please complete your profile before setting goals.")

        bmi = profile.bmi
        if not bmi and profile.height_cm and profile.weight_kg:
            bmi = calculate_bmi(profile.weight_kg, profile.height_cm)

        if not bmi:
            raise HTTPException(status_code=400, detail="Height and weight required in profile for BMI validation.")

        # Deactivate previous goals
        prev_result = await db.execute(
            select(FitnessGoal).where(FitnessGoal.user_id == user_id, FitnessGoal.is_active == True)
        )
        for old_goal in prev_result.scalars().all():
            old_goal.is_active = False

        # Run AI validation
        ai_report = validate_goal_against_bmi(bmi, data.goal_type, data.activity_level)

        goal = FitnessGoal(
            user_id=user_id,
            goal_type=data.goal_type,
            activity_level=data.activity_level,
            target_weight_kg=data.target_weight_kg,
            ai_report=ai_report,
            ml_score=ai_report.get("ml_score"),
            is_active=True,
        )
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        return goal

    @staticmethod
    async def get_active_goal(db: AsyncSession, user_id: uuid.UUID) -> FitnessGoal:
        result = await db.execute(
            select(FitnessGoal).where(FitnessGoal.user_id == user_id, FitnessGoal.is_active == True)
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="No active goal found.")
        return goal

    @staticmethod
    async def get_all_goals(db: AsyncSession, user_id: uuid.UUID) -> list:
        result = await db.execute(
            select(FitnessGoal).where(FitnessGoal.user_id == user_id).order_by(FitnessGoal.created_at.desc())
        )
        return result.scalars().all()
