from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_
from sqlalchemy.exc import IntegrityError
from app.models.user import User
from app.models.profile import Profile
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.cache import cache_set
from app.core.config import settings
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RegisterResponse
from fastapi import HTTPException, status
import uuid
import time
from datetime import datetime, timedelta

# In-memory store for password reset tokens {token: (user_id, expires_at)}
_reset_tokens: dict = {}


class AuthService:

    @staticmethod
    async def _find_user_for_login(db: AsyncSession, identifier: str) -> User | None:
        normalized_identifier = (identifier or "").strip().lower()
        if not normalized_identifier:
            return None

        lookup_attempts = [
            select(User).where(func.lower(User.email) == normalized_identifier).limit(1),
            select(User)
            .where(func.lower(func.split_part(User.email, "@", 1)) == normalized_identifier)
            .limit(1),
            select(User)
            .join(Profile, Profile.user_id == User.id)
            .where(func.lower(Profile.username) == normalized_identifier)
            .order_by(User.created_at.desc())
            .limit(1),
        ]

        for query in lookup_attempts:
            result = await db.execute(query)
            user = result.scalars().first()
            if user:
                return user
        return None

    @staticmethod
    async def register(db: AsyncSession, data: RegisterRequest) -> RegisterResponse:
        email = str(data.email).strip().lower()
        phone = (str(data.phone).strip() if data.phone else None) or None

        # Check if email already exists (case-insensitive)
        result = await db.execute(
            select(User).where(func.lower(User.email) == email)
        )
        existing_user = result.scalar_one_or_none()
        if existing_user:
            if not existing_user.hashed_password:
                raise HTTPException(
                    status_code=400,
                    detail="This account uses Google sign-in. Use Continue with Google.",
                )

            if verify_password(data.password, existing_user.hashed_password):
                token_data = {
                    "sub": str(existing_user.id),
                    "email": existing_user.email,
                    "role": existing_user.role,
                }
                return RegisterResponse(
                    message="Account already existed. Signed you in.",
                    access_token=create_access_token(token_data),
                    refresh_token=create_refresh_token(token_data),
                )

            raise HTTPException(
                status_code=400,
                detail="Email already registered. Use the existing password to sign in.",
            )

        # Check if phone already exists when provided
        if phone:
            phone_result = await db.execute(select(User).where(User.phone == phone))
            if phone_result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Phone number already registered")

        user = User(
            email=email,
            phone=phone,
            hashed_password=hash_password(data.password),
            is_active=True,
        )
        try:
            db.add(user)
            await db.commit()
            await db.refresh(user)
        except IntegrityError as exc:
            await db.rollback()
            error_text = str(getattr(exc, "orig", exc)).lower()
            if "users_phone_key" in error_text or "phone" in error_text:
                raise HTTPException(status_code=400, detail="Phone number already registered")
            if "users_email_key" in error_text or "email" in error_text:
                existing_res = await db.execute(
                    select(User).where(func.lower(User.email) == email)
                )
                existing_user = existing_res.scalar_one_or_none()
                if existing_user and existing_user.hashed_password and verify_password(data.password, existing_user.hashed_password):
                    token_data = {
                        "sub": str(existing_user.id),
                        "email": existing_user.email,
                        "role": existing_user.role,
                    }
                    return RegisterResponse(
                        message="Account already existed. Signed you in.",
                        access_token=create_access_token(token_data),
                        refresh_token=create_refresh_token(token_data),
                    )
                raise HTTPException(
                    status_code=400,
                    detail="Email already registered. Use the existing password to sign in.",
                )
            raise HTTPException(
                status_code=400,
                detail="Registration failed due to invalid or duplicate data",
            )
        token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
        return RegisterResponse(
            message="Registration successful. Please complete your profile.",
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
        )

    @staticmethod
    async def login(db: AsyncSession, data: LoginRequest) -> TokenResponse:
        user = await AuthService._find_user_for_login(db, data.identifier)

        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.hashed_password:
            if user.is_google_user:
                raise HTTPException(
                    status_code=400,
                    detail="This account uses Google sign-in. Use Continue with Google.",
                )
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
    async def logout(user_id: uuid.UUID) -> dict:
        """Invalidate all tokens for this user by recording the logout timestamp."""
        logout_time = int(time.time())
        ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400 + 3600
        await cache_set(f"logout_time:{user_id}", logout_time, ttl=ttl)
        return {"message": "Logged out successfully."}

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
