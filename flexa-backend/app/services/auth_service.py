from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.user import User
from app.models.profile import Profile
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from fastapi import HTTPException, status
import uuid


class AuthService:

    @staticmethod
    async def register(db: AsyncSession, data: RegisterRequest) -> dict:
        # Check if user exists
        result = await db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

        user = User(
            email=data.email,
            phone=data.phone,
            hashed_password=hash_password(data.password),
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return {"message": "Registration successful. Please complete your profile."}

    @staticmethod
    async def login(db: AsyncSession, data: LoginRequest) -> TokenResponse:
        result = await db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not user.hashed_password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(data.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")

        token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
        )

    @staticmethod
    async def refresh_token(db: AsyncSession, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
        )

    @staticmethod
    async def google_login_or_create(db: AsyncSession, google_user_info: dict) -> TokenResponse:
        email = google_user_info.get("email")
        google_id = google_user_info.get("sub")

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                email=email,
                google_id=google_id,
                is_google_user=True,
                is_verified=True,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
        )
