from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional
from app.models.user import UserRole, UserStatus

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    status: UserStatus
    last_login: Optional[datetime] = None

class UserCreate(UserBase):
    password: str
    company_id: UUID

class UserResponse(UserBase):
    id: UUID
    company_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
