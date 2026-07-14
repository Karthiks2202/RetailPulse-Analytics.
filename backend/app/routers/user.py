from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/users", tags=["users"])

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
