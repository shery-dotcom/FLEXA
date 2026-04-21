from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

# Always resolve .env relative to this file (flexa-backend/app/core/config.py)
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    APP_NAME: str = "Flexa AI Fitness Planner"
    APP_VERSION: str = "1.0.1"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production-at-least-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/flexa_db"
    SYNC_DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/flexa_db"

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Stripe test mode
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_CURRENCY: str = "usd"
    STRIPE_SUCCESS_URL: Optional[str] = None
    STRIPE_CANCEL_URL: Optional[str] = None
    STRIPE_DEMO_MODE: bool = True

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # AI / LLM
    GROQ_API_KEY: Optional[str] = None

    class Config:
        env_file = str(_ENV_FILE)
        case_sensitive = True

    @property
    def allowed_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
        return [origin for origin in origins if origin]


settings = Settings()
