from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, MessageResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.register(db, data)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(db, data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.refresh_token(db, data.refresh_token)


@router.get("/google")
async def google_auth_redirect():
    from app.core.config import settings
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        "&response_type=code"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
    )
    return {"auth_url": google_auth_url}


@router.get("/google/callback", response_model=TokenResponse)
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    import httpx
    from app.core.config import settings

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_response.json()
        access_token = token_data.get("access_token")

        # Get user info
        user_info_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_info = user_info_response.json()

    return await AuthService.google_login_or_create(db, user_info)
