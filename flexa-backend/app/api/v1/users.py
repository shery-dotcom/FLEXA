from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.user_service import UserService
from app.schemas.user import ProfileCreate, ProfileUpdate, ProfileResponse, UserResponse

router = APIRouter(prefix="/users", tags=["Users & Profiles"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await UserService.get_user_with_profile(db, current_user.id)


@router.post("/me/profile", response_model=ProfileResponse, status_code=201)
async def create_profile(
    data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await UserService.create_profile(db, current_user.id, data)


@router.put("/me/profile", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await UserService.update_profile(db, current_user.id, data)
