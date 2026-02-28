from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from app.models.progress import ProgressLog, Achievement
from app.schemas.progress import ProgressLogCreate, WeeklySummaryResponse
from app.ml.milestone_detector import generate_progress_summary
from app.ml.bmi_validator import calculate_bmi, classify_bmi
from app.models.profile import Profile
from datetime import date, timedelta
import uuid
from typing import List


class ProgressService:

    @staticmethod
    async def log_progress(db: AsyncSession, user_id: uuid.UUID, data: ProgressLogCreate) -> ProgressLog:
        # Auto-calc BMI if not provided
        bmi = data.bmi
        if not bmi and data.weight_kg:
            profile_result = await db.execute(select(Profile).where(Profile.user_id == user_id))
            profile = profile_result.scalar_one_or_none()
            if profile and profile.height_cm:
                bmi = calculate_bmi(data.weight_kg, profile.height_cm)
                # Update profile weight and BMI
                profile.weight_kg = data.weight_kg
                profile.bmi = bmi
                profile.bmi_category = classify_bmi(bmi)

        log = ProgressLog(
            user_id=user_id,
            log_date=data.log_date,
            weight_kg=data.weight_kg,
            bmi=bmi,
            body_fat_pct=data.body_fat_pct,
            notes=data.notes,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    @staticmethod
    async def get_logs(db: AsyncSession, user_id: uuid.UUID, limit: int = 90) -> List[ProgressLog]:
        result = await db.execute(
            select(ProgressLog)
            .where(ProgressLog.user_id == user_id)
            .order_by(ProgressLog.log_date.desc())
            .limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def get_weekly_summary(db: AsyncSession, user_id: uuid.UUID) -> dict:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        result = await db.execute(
            select(ProgressLog).where(
                ProgressLog.user_id == user_id,
                ProgressLog.log_date >= week_start,
                ProgressLog.log_date <= week_end,
            )
        )
        logs = result.scalars().all()
        log_dicts = [{"weight_kg": l.weight_kg, "bmi": l.bmi} for l in logs]

        summary = generate_progress_summary(log_dicts, "recomp")
        summary["week_start"] = week_start
        summary["week_end"] = week_end
        summary["logs_count"] = len(logs)
        return summary

    @staticmethod
    async def get_monthly_summary(db: AsyncSession, user_id: uuid.UUID) -> dict:
        today = date.today()
        month_start = today.replace(day=1)

        result = await db.execute(
            select(ProgressLog).where(
                ProgressLog.user_id == user_id,
                ProgressLog.log_date >= month_start,
            )
        )
        logs = result.scalars().all()
        log_dicts = [{"weight_kg": l.weight_kg, "bmi": l.bmi} for l in logs]

        summary = generate_progress_summary(log_dicts, "recomp")
        summary["month"] = month_start.strftime("%B %Y")
        summary["logs_count"] = len(logs)
        return summary
