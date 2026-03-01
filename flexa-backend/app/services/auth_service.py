from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.user import User
from app.models.profile import Profile
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from fastapi import HTTPException, status
import uuid
from datetime import datetime, timedelta

# In-memory store for password reset tokens {token: (user_id, expires_at)}
_reset_tokens: dict = {}


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
    async def forgot_password(db: AsyncSession, email: str) -> dict:
        """Generate a reset token (in-memory for demo). Returns token for dev/demo."""
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        # Always return success to prevent email enumeration
        if not user:
            return {"message": "If this email is registered, you will receive reset instructions."}

        token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=1)
        _reset_tokens[token] = (str(user.id), expires_at)

        return {
            "message": "If this email is registered, you will receive reset instructions.",
            "reset_token": token,  # returned for demo — in production send via email
        }

    @staticmethod
    async def reset_password(db: AsyncSession, token: str, new_password: str) -> dict:
        """Validate reset token and update password."""
        entry = _reset_tokens.get(token)
        if not entry:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

        user_id, expires_at = entry
        if datetime.utcnow() > expires_at:
            del _reset_tokens[token]
            raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        user.hashed_password = hash_password(new_password)
        await db.commit()
        del _reset_tokens[token]
        return {"message": "Password updated successfully."}

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
