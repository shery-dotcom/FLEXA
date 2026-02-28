from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.workout import Workout, WorkoutSession, FitnessGoal
from app.models.profile import Profile
from app.schemas.workout import WorkoutPlanRequest
from app.ml.workout_recommender import generate_workout_plan
from app.ml.workout_ml_predictor import predict_split
import logging

logger = logging.getLogger(__name__)
import uuid
from typing import List


class WorkoutService:

    @staticmethod
    async def generate_and_save_plan(db: AsyncSession, user_id: uuid.UUID, data: WorkoutPlanRequest) -> List[Workout]:
        profile_res = await db.execute(select(Profile).where(Profile.user_id == user_id))
        profile = profile_res.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=400, detail="Complete your profile before generating workouts.")

        goal_res = await db.execute(
            select(FitnessGoal).where(FitnessGoal.user_id == user_id, FitnessGoal.is_active == True)
        )
        goal = goal_res.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=400, detail="Set a fitness goal before generating workouts.")

        bmi = profile.bmi or 22.0

        # ── ML split prediction ───────────────────────────────────────────────
        try:
            ml_split = predict_split(
                goal_type=goal.goal_type,
                activity_level=goal.activity_level,
                gender=profile.gender,
                age=profile.age,
            )
            logger.info("ML recommended split: %s", ml_split)
        except Exception as exc:
            logger.warning("ML predictor failed, falling back to rule-based: %s", exc)
            ml_split = None

        week_num = data.week_number or 1

        if week_num == 1:
            # Fresh plan: remove all existing weeks so old data doesn't linger
            existing = await db.execute(select(Workout).where(Workout.user_id == user_id))
        else:
            # Just overwrite the specific week being generated
            existing = await db.execute(
                select(Workout).where(Workout.user_id == user_id, Workout.week_number == week_num)
            )
        for w in existing.scalars().all():
            await db.delete(w)

        plan_dicts = generate_workout_plan(
            goal_type=goal.goal_type,
            activity_level=goal.activity_level,
            bmi=bmi,
            frequency_per_week=data.frequency_per_week,
            week_number=week_num,
            split_type=ml_split,
        )

        workouts = []
        for wd in plan_dicts:
            w = Workout(
                user_id=user_id,
                name=wd["name"],
                week_number=wd["week_number"],
                day_of_week=wd["day_of_week"],
                is_rest_day=wd["is_rest_day"],
                exercises=wd["exercises"],
                warmup=wd["warmup"],
                cooldown=wd["cooldown"],
                duration_minutes=wd["duration_minutes"],
                difficulty=wd["difficulty"],
                ai_generated=True,
            )
            db.add(w)
            workouts.append(w)

        await db.commit()
        for w in workouts:
            await db.refresh(w)

        return workouts

    @staticmethod
    async def get_user_workouts(db: AsyncSession, user_id: uuid.UUID, week: int = 1) -> List[Workout]:
        result = await db.execute(
            select(Workout)
            .where(Workout.user_id == user_id, Workout.week_number == week)
            .order_by(Workout.day_of_week)
        )
        return result.scalars().all()

    @staticmethod
    async def complete_workout_session(db: AsyncSession, user_id: uuid.UUID, workout_id: uuid.UUID) -> WorkoutSession:
        result = await db.execute(select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id))
        workout = result.scalar_one_or_none()
        if not workout:
            raise HTTPException(status_code=404, detail="Workout not found.")
        if workout.is_rest_day:
            raise HTTPException(status_code=400, detail="Cannot complete a rest day.")

        session = WorkoutSession(workout_id=workout_id, user_id=user_id, duration_minutes=workout.duration_minutes)
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session
