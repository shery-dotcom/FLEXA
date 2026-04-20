from pydantic import BaseModel, EmailStr, validator, root_validator
from typing import Optional
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    phone: Optional[str] = None

    @validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    identifier: str
    password: str

    @root_validator(pre=True)
    def map_email_to_identifier(cls, values):
        # Backward compatibility: old clients may still send {email, password}
        identifier = values.get("identifier") or values.get("email")
        if identifier is not None:
            values["identifier"] = str(identifier).strip()
        return values


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: Optional[str] = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class GoogleCallbackRequest(BaseModel):
    code: str


class MessageResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @validator("new_password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
