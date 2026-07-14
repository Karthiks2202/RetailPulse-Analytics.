from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

class RegisterRequest(BaseModel):
    company_name: str
    industry: str
    company_email: EmailStr
    company_address: str
    company_phone: str
    owner_name: str
    owner_email: EmailStr
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class MessageResponse(BaseModel):
    message: str
