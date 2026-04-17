from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.user import User
from app.models.profile import Profile
from app.models.workout import FitnessGoal, WorkoutSession, Workout
from app.models.progress import DashboardTask, Achievement, ProgressLog
from app.ml.motivation_engine import compute_motivation_score
from app.ml.milestone_detector import detect_milestones
from app.schemas.progress import DashboardResponse, DashboardTaskResponse, MilestoneResponse
from datetime import date, datetime, timedelta
import uuid
from typing import List


class DashboardService:

    @staticmethod
    def _compute_calories(profile, goal_type: str, activity_level: str):
        """Mifflin-St Jeor TDEE + goal adjustment."""
        if not profile or not profile.weight_kg or not profile.height_cm or not profile.age:
            return None, None
        w, h, a = profile.weight_kg, profile.height_cm, profile.age
        gender = (profile.gender or "male").lower()
        if gender == "female":
            bmr = 10 * w + 6.25 * h - 5 * a - 161
        else:
            bmr = 10 * w + 6.25 * h - 5 * a + 5
        multipliers = {
            "sedentary": 1.2, "light": 1.375, "moderate": 1.55,
            "active": 1.725, "very_active": 1.9,
        }
        mult = multipliers.get(activity_level.lower().replace(" ", "_"), 1.55)
        tdee = round(bmr * mult)
        adj = {"cutting": -500, "bulking": 400, "recomp": -250, "maintaining": 0}.get(
            (goal_type or "maintaining").lower(), 0
        )
        return tdee, max(1200, tdee + adj)

    @staticmethod
    async def get_dashboard(db: AsyncSession, user_id: uuid.UUID) -> dict:
        # Load user with profile
        user_result = await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        profile = user.profile
        username = profile.username if profile else user.email.split("@")[0]

        # Active goal
        goal_result = await db.execute(
            select(FitnessGoal).where(FitnessGoal.user_id == user_id, FitnessGoal.is_active == True)
        )
        goal = goal_result.scalar_one_or_none()

        # Sessions this week
        week_start = date.today() - timedelta(days=date.today().weekday())
        week_sessions_result = await db.execute(
            select(func.count()).select_from(WorkoutSession).where(
                WorkoutSession.user_id == user_id,
                WorkoutSession.completed_at >= datetime.combine(week_start, datetime.min.time())
            )
        )
        weekly_sessions = week_sessions_result.scalar() or 0

        # Total sessions
        total_result = await db.execute(
            select(func.count()).select_from(WorkoutSession).where(WorkoutSession.user_id == user_id)
        )
        total_sessions = total_result.scalar() or 0

        # Has workout plan
        plan_result = await db.execute(
            select(func.count()).select_from(Workout).where(Workout.user_id == user_id)
        )
        has_workout_plan = (plan_result.scalar() or 0) > 0

        # Days since joined
        days_since_joined = (datetime.utcnow() - user.created_at.replace(tzinfo=None)).days if user.created_at else 0

        # Today's tasks
        today_tasks_result = await db.execute(
            select(DashboardTask).where(
                DashboardTask.user_id == user_id,
                DashboardTask.task_date == date.today()
            ).order_by(DashboardTask.priority)
        )
        today_tasks = today_tasks_result.scalars().all()

        # Auto-generate today's tasks if empty
        if not today_tasks:
            today_tasks = await DashboardService._generate_daily_tasks(db, user_id, goal)

        # Compute motivation
        motivation = compute_motivation_score(
            sessions_this_week=weekly_sessions,
            frequency_goal=goal.ai_report.get("frequency", 3) if goal and goal.ai_report else 3,
            streak_days=min(total_sessions, days_since_joined),
            goal_type=goal.goal_type if goal else "recomp",
            days_since_joined=days_since_joined,
        )

        # Detect milestones
        # Compute actual weight delta from progress logs
        oldest_w_r = await db.execute(
            select(ProgressLog.weight_kg)
            .where(ProgressLog.user_id == user_id, ProgressLog.weight_kg.isnot(None))
            .order_by(ProgressLog.log_date.asc()).limit(1)
        )
        oldest_weight = oldest_w_r.scalar_one_or_none()
        latest_w_r = await db.execute(
            select(ProgressLog.weight_kg)
            .where(ProgressLog.user_id == user_id, ProgressLog.weight_kg.isnot(None))
            .order_by(ProgressLog.log_date.desc()).limit(1)
        )
        latest_weight = latest_w_r.scalar_one_or_none()
        weight_lost_kg = max(0.0, round((oldest_weight or 0) - (latest_weight or 0), 2)) if oldest_weight and latest_weight else 0.0

        milestone_data = {
            "total_sessions": total_sessions,
            "streak_days": min(total_sessions, days_since_joined),
            "current_bmi": profile.bmi if profile else 0,
            "weight_lost_kg": weight_lost_kg,
            "days_since_joined": days_since_joined,
        }
        milestones = detect_milestones(milestone_data)

        # Persist newly earned achievements
        existing_r = await db.execute(
            select(Achievement.title).where(Achievement.user_id == user_id)
        )
        existing_titles = {row[0] for row in existing_r.all()}
        new_achievements = []
        for m in milestones:
            if m["title"] not in existing_titles:
                db.add(Achievement(
                    user_id=user_id,
                    title=m["title"],
                    description=m["description"],
                    badge_type=m["milestone_type"],
                ))
                new_achievements.append(m["title"])
        if new_achievements:
            await db.commit()

        # Calories
        act_level = goal.activity_level if goal else "moderate"
        goal_type = goal.goal_type if goal else "maintaining"
        daily_calories, target_calories = DashboardService._compute_calories(profile, goal_type, act_level)

        return {
            "user_name": username,
            "bmi": profile.bmi if profile else None,
            "bmi_category": profile.bmi_category if profile else None,
            "current_goal": goal_type,
            "activity_level": act_level,
            "daily_calories": daily_calories,
            "target_calories": target_calories,
            "has_workout_plan": has_workout_plan,
            "motivation_message": motivation["message"],
            "motivation_score": motivation["motivation_score"],
            "today_tasks": [DashboardTaskResponse.model_validate(t) for t in today_tasks],
            "milestones": [MilestoneResponse(
                title=m["title"],
                description=m["description"],
                milestone_type=m["milestone_type"],
                achieved_at=datetime.utcnow(),
            ) for m in milestones],
            "weekly_sessions": weekly_sessions,
            "total_workouts_completed": total_sessions,
        }

    @staticmethod
    async def _generate_daily_tasks(db: AsyncSession, user_id: uuid.UUID, goal) -> List[DashboardTask]:
        task_templates = [
            {"title": "Complete Today's Workout", "description": "Check your workout plan and complete the session.", "task_type": "workout", "priority": 1},
            {"title": "Track Your Weight", "description": "Log your weight in the progress tracker.", "task_type": "tracking", "priority": 2},
            {"title": "Hit Hydration Goal", "description": "Drink at least 2.5L of water today.", "task_type": "hydration", "priority": 3},
            {"title": "Get Quality Sleep", "description": "Aim for 7-9 hours of sleep tonight.", "task_type": "rest", "priority": 4},
        ]

        if goal and goal.goal_type == "bulking":
            task_templates.append({"title": "Hit Protein Target", "description": "Ensure you're hitting 2g protein per kg bodyweight.", "task_type": "nutrition", "priority": 2})
        elif goal and goal.goal_type == "cutting":
            task_templates.append({"title": "Track Calories", "description": "Log all meals and maintain your calorie deficit.", "task_type": "nutrition", "priority": 2})
        elif goal and goal.goal_type in ("recomp", "maintaining"):
            task_templates.append({"title": "Track Nutrition", "description": "Log your meals and monitor macro balance.", "task_type": "nutrition", "priority": 2})

        tasks = []
        for tmpl in task_templates:
            t = DashboardTask(
                user_id=user_id,
                task_date=date.today(),
                title=tmpl["title"],
                description=tmpl["description"],
                task_type=tmpl["task_type"],
                priority=tmpl["priority"],
            )
            db.add(t)
            tasks.append(t)

        await db.commit()
        return tasks

    @staticmethod
    async def complete_task(db: AsyncSession, user_id: uuid.UUID, task_id: uuid.UUID) -> DashboardTask:
        result = await db.execute(
            select(DashboardTask).where(DashboardTask.id == task_id, DashboardTask.user_id == user_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task.is_completed = True
        await db.commit()
        await db.refresh(task)
        return task
