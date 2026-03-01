from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.user import User
from app.models.profile import Profile
from app.schemas.user import ProfileCreate, ProfileUpdate, UserResponse
from app.ml.bmi_validator import calculate_bmi, classify_bmi
import uuid


class UserService:

    @staticmethod
    async def get_user_with_profile(db: AsyncSession, user_id: uuid.UUID) -> User:
        result = await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    @staticmethod
    async def create_profile(db: AsyncSession, user_id: uuid.UUID, data: ProfileCreate) -> Profile:
        # Check if profile exists
        result = await db.execute(select(Profile).where(Profile.user_id == user_id))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Profile already exists. Use update instead.")

        bmi = None
        bmi_category = None
        if data.height_cm and data.weight_kg:
            bmi = calculate_bmi(data.weight_kg, data.height_cm)
            bmi_category = classify_bmi(bmi)

        profile = Profile(
            user_id=user_id,
            username=data.username,
            age=data.age,
            gender=data.gender,
            region=data.region,
            height_cm=data.height_cm,
            weight_kg=data.weight_kg,
            bmi=bmi,
            bmi_category=bmi_category,
            profile_picture=data.profile_picture if hasattr(data, "profile_picture") else None,
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        return profile

    @staticmethod
    async def update_profile(db: AsyncSession, user_id: uuid.UUID, data: ProfileUpdate) -> Profile:
        result = await db.execute(select(Profile).where(Profile.user_id == user_id))
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found. Create one first.")

        update_data = data.model_dump(exclude_unset=True)

        # Recalculate BMI if height or weight changed
        height = update_data.get("height_cm", profile.height_cm)
        weight = update_data.get("weight_kg", profile.weight_kg)
        if height and weight:
            update_data["bmi"] = calculate_bmi(weight, height)
            update_data["bmi_category"] = classify_bmi(update_data["bmi"])

        for field, value in update_data.items():
            setattr(profile, field, value)

        await db.commit()
        await db.refresh(profile)
        return profile
