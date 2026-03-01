from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class ProfileCreate(BaseModel):
    username: str
    age: Optional[int] = None
    gender: Optional[str] = None
    region: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    profile_picture: Optional[str] = None


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    region: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    profile_picture: Optional[str] = None


class ProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    age: Optional[int]
    gender: Optional[str]
    region: Optional[str]
    height_cm: Optional[float]
    weight_kg: Optional[float]
    bmi: Optional[float]
    bmi_category: Optional[str]
    profile_picture: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    phone: Optional[str]
    is_active: bool
    is_google_user: bool
    role: str
    created_at: datetime
    profile: Optional[ProfileResponse] = None

    class Config:
        from_attributes = True
