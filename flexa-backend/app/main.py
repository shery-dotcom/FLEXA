import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.database import init_db
from app.api.v1.router import router
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.cache import close_redis
from app.ml.meal_recommender_ml import get_recommender
from app.chatbot import rag as rag_mod


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    await init_db()
    # Invalidate ML meal recommender so it refits with merged BUILTIN_FOODS on first request
    get_recommender().invalidate()
    # Warm up RAG assets in background so startup stays fast.
    async def _warmup_rag():
        try:
            await asyncio.to_thread(rag_mod.retrieve, "warmup", 1, "general")
        except Exception as e:
            print(f"[WARN] RAG warmup skipped: {e}")

    asyncio.create_task(_warmup_rag())
    print(f"[OK] {settings.APP_NAME} v{settings.APP_VERSION} started")
    yield
    # Shutdown: release Redis connection
    await close_redis()
    print("[--] Server shutting down...")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        # slowapi rate-limit error handler registered below
        version=settings.APP_VERSION,
        description="""
## Flexa AI Fitness Planner API

A production-ready AI-powered fitness planning system.

### Key Features
- **Module 1**: JWT Authentication + Google OAuth + User Profiles
- **Module 2**: AI Goal Setting with BMI Validation
- **Module 3**: Personalized Diet & Calorie Planner (BMR/TDEE, Meal Recommender, Food Image AI)
- **Module 4**: AI Workout Generator (Rule + ML Hybrid)
- **Module 7**: Smart Dashboard with Motivation Engine
- **Module 10**: Progress Visualization & Milestone Detection

### Authentication
Use JWT Bearer tokens. Get tokens via `/api/v1/auth/login`.
        """,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS - explicitly allow Vercel frontend and ngrok/localhost dev
    cors_origins = settings.allowed_origins_list
    # Ensure critical URLs are always included
    critical_origins = [
        "https://flexa-ashen.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    for origin in critical_origins:
        if origin not in cors_origins:
            cors_origins.append(origin)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=86400,
    )

    # Include all routers
    app.include_router(router)

    @app.get("/", tags=["Health"])
    async def root():
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "operational",
            "docs": "/docs",
        }

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "healthy"}

    return app


app = create_app()
