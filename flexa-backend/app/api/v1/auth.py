import secrets

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.auth_service import AuthService
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, MessageResponse, ForgotPasswordRequest, ResetPasswordRequest, RegisterResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

# CORS preflight handler for auth endpoints
@router.options("/{rest_of_path:path}")
async def preflight(rest_of_path: str):
    """Handle CORS preflight requests for all auth endpoints"""
    return JSONResponse(content={}, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    })


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService.register(db, data)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Registration failed. Please try again or contact support."
        )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(db, data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.refresh_token(db, data.refresh_token)


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.forgot_password(db, data.email)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.reset_password(db, data.token, data.new_password)


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Invalidate all tokens for the current user. Client should also discard local tokens."""
    return await AuthService.logout(current_user.id)


@router.get("/google")
async def google_auth_redirect():
    from app.core.config import settings
    state = secrets.token_urlsafe(32)
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        "&response_type=code"
        f"&state={state}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=select_account"
    )
    response = RedirectResponse(url=google_auth_url)
    response.set_cookie(
        key="google_oauth_state",
        value=state,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=600,
        path="/api/v1/auth",
    )
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str = None,
    state: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db),
):
    import httpx
    from app.core.config import settings
    
    frontend_url = settings.FRONTEND_URL
    expected_state = request.cookies.get("google_oauth_state")
    if expected_state and state != expected_state:
        return RedirectResponse(
            url=f"{frontend_url}/auth/google/error?error=invalid_state",
            status_code=302,
        )

    # Handle user cancellation
    if error:
        return RedirectResponse(
            url=f"{frontend_url}/auth/google/error?error={error}",
            status_code=302
        )

    if not code:
        return RedirectResponse(
            url=f"{frontend_url}/auth/google/error?error=no_code",
            status_code=302
        )

    try:
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
                timeout=10.0,
            )
            token_data = token_response.json()
            
            if "error" in token_data:
                return RedirectResponse(
                    url=f"{frontend_url}/auth/google/error?error=token_exchange_failed",
                    status_code=302
                )
            
            access_token = token_data.get("access_token")
            if not access_token:
                return RedirectResponse(
                    url=f"{frontend_url}/auth/google/error?error=no_access_token",
                    status_code=302
                )

            # Get user info
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0,
            )
            user_info = user_info_response.json()
            
            if "error" in user_info:
                return RedirectResponse(
                    url=f"{frontend_url}/auth/google/error?error=user_info_failed",
                    status_code=302
                )

        tokens = await AuthService.google_login_or_create(db, user_info)

        # Redirect browser back to React with tokens in the URL fragment so they
        # are not sent to the server or stored in access logs.
        redirect_url = (
            f"{frontend_url}/auth/google/success"
            f"#access_token={tokens.access_token}"
            f"&refresh_token={tokens.refresh_token}"
        )
        response = RedirectResponse(url=redirect_url)
        response.delete_cookie("google_oauth_state", path="/api/v1/auth")
        return response
    
    except Exception as e:
        return RedirectResponse(
            url=f"{frontend_url}/auth/google/error?error=callback_failed",
            status_code=302
        )
