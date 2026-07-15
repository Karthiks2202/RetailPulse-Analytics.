from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.refresh_token import RefreshToken
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, LogoutRequest, ChangePasswordRequest, MessageResponse
from app.schemas.company import CompanyResponse
from app.schemas.user import UserResponse
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.services.audit import audit_service
from app.middleware.error_handler import RetailPulseException
from uuid import UUID

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=dict)
async def register(payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise RetailPulseException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
    if len(payload.password) < 8:
        raise RetailPulseException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")

    existing_company = await db.execute(select(Company).where(Company.email == payload.company_email))
    if existing_company.scalar_one_or_none():
        raise RetailPulseException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company email is already registered")

    existing_user = await db.execute(select(User).where(User.email == payload.owner_email))
    if existing_user.scalar_one_or_none():
        raise RetailPulseException(status_code=status.HTTP_400_BAD_REQUEST, detail="User email is already registered")

    hashed = hash_password(payload.password)

    company = Company(
        name=payload.company_name,
        industry=payload.industry,
        email=payload.company_email,
        address=payload.company_address,
        phone=payload.company_phone,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)

    user = User(
        company_id=company.id,
        name=payload.owner_name,
        email=payload.owner_email,
        password=hashed,
        role="COMPANY_ADMIN",
        status="ACTIVE",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await audit_service.log(db, company_id=company.id, user_id=user.id, action="Company Registered", request=request)

    return {
        "message": "Company and Admin user registered successfully",
        "company": {"id": str(company.id), "name": company.name},
        "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value},
    }

@router.post("/login")
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.status.value != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    if not verify_password(payload.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access_token = create_access_token(user.id, user.email, user.role.value, user.company_id)
    refresh_token = create_refresh_token(user.id)
    rt_exp = datetime.utcnow() + timedelta(days=7)

    rt = RefreshToken(user_id=user.id, token=refresh_token, expires_at=rt_exp)
    db.add(rt)

    user.last_login = datetime.utcnow()
    db.add(user)

    await db.commit()
    await audit_service.log(db, company_id=user.company_id, user_id=user.id, action="User Login", request=request)

    company_result = await db.execute(select(Company).where(Company.id == user.company_id))
    company = company_result.scalar_one_or_none()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "company_id": str(user.company_id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "status": user.status.value,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat(),
            "company": {
                "id": str(company.id) if company else None,
                "name": company.name if company else None,
            },
        },
    }

@router.post("/refresh")
async def refresh(payload: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        decoded = decode_refresh_token(payload.refresh_token)
        user_id = UUID(decoded["sub"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(RefreshToken).where(RefreshToken.token == payload.refresh_token))
    stored = result.scalar_one_or_none()
    if not stored or stored.expires_at < datetime.utcnow():
        if stored:
            await db.delete(stored)
            await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or invalid")

    user = await db.get(User, stored.user_id)
    if not user or user.status.value != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    new_access = create_access_token(user.id, user.email, user.role.value, user.company_id)
    new_refresh = create_refresh_token(user.id)
    new_exp = datetime.utcnow() + timedelta(days=7)

    await db.delete(stored)
    new_rt = RefreshToken(user_id=user.id, token=new_refresh, expires_at=new_exp)
    db.add(new_rt)
    await db.commit()

    company_result = await db.execute(select(Company).where(Company.id == user.company_id))
    company = company_result.scalar_one_or_none()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "user": {
            "id": str(user.id),
            "company_id": str(user.company_id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "status": user.status.value,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat(),
            "company": {
                "id": str(company.id) if company else None,
                "name": company.name if company else None,
            },
        },
    }

@router.post("/logout", response_model=MessageResponse)
async def logout(payload: LogoutRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == payload.refresh_token))
    stored = result.scalar_one_or_none()
    if stored:
        user = await db.get(User, stored.user_id)
        if user:
            await audit_service.log(db, company_id=user.company_id, user_id=user.id, action="User Logout", request=request)
        await db.delete(stored)
        await db.commit()
    return MessageResponse(message="Logged out successfully")
