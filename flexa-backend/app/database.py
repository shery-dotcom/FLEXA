from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={"timeout": 30},  # asyncpg connect timeout — prevents cold-start failures on Neon
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup and apply additive column migrations."""
    # Import all models so SQLAlchemy registers them before create_all
    import app.models  # noqa: F401 — triggers all model imports
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # ── Idempotent column additions (PostgreSQL IF NOT EXISTS) ──────
        await conn.execute(
            text("ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS calorie_intake FLOAT")
        )
        # Widen profile_picture column to TEXT to support base64 data URLs
        await conn.execute(
            text("ALTER TABLE profiles ALTER COLUMN profile_picture TYPE TEXT")
        )
