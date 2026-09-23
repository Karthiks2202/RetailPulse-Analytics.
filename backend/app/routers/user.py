from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserResponse, UserCreate
from app.utils.dependencies import get_current_active_user
from app.services.audit import audit_service

router = APIRouter(prefix="/users", tags=["users"])


def is_admin(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)


@router.get("", response_model=list[UserResponse])
async def list_users(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.company_id == current_user.company_id))
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            company_id=u.company_id,
            name=u.name,
            email=u.email,
            role=u.role,
            status=u.status,
            last_login=u.last_login,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if payload.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Access denied: Resource belongs to another company")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        company_id=payload.company_id,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        role=payload.role,
        status=payload.status,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "User Created",
        request,
        resource_type="User",
        resource_id=user.id,
        description=f"Created user '{user.name}' with role {payload.role.value}",
    )

    return UserResponse(
        id=user.id,
        company_id=user.company_id,
        name=user.name,
        email=user.email,
        role=user.role,
        status=user.status,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    request: Request,
    new_role: UserRole,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    user = await db.get(User, user_id)
    if not user or user.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot modify Super Admin role")

    old_role = user.role
    user.role = new_role
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Role Changed",
        request,
        resource_type="User",
        resource_id=user.id,
        description=f"Changed role for '{user.name}' from {old_role.value} to {new_role.value}",
        before_values={"role": old_role.value},
        after_values={"role": new_role.value},
    )

    return UserResponse(
        id=user.id,
        company_id=user.company_id,
        name=user.name,
        email=user.email,
        role=user.role,
        status=user.status,
        last_login=user.last_login,
        created_at=user.created_at,
    )
