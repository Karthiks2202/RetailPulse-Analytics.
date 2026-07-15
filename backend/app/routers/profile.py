from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.schemas.auth import ChangePasswordRequest, MessageResponse
from app.utils.dependencies import get_current_active_user
from app.utils.security import verify_password, hash_password
from app.services.audit import audit_service
from app.middleware.error_handler import RetailPulseException

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    company_result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = company_result.scalar_one_or_none()
    return {
        "id": str(current_user.id),
        "company_id": str(current_user.company_id),
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.value,
        "status": current_user.status.value,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
        "created_at": current_user.created_at.isoformat(),
        "company": {
            "id": str(company.id) if company else None,
            "name": company.name if company else None,
        },
    }

@router.post("/change-password", response_model=MessageResponse)
async def change_password(payload: ChangePasswordRequest, request: Request, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    if not verify_password(payload.current_password, current_user.password):
        raise RetailPulseException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise RetailPulseException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    current_user.password = hash_password(payload.new_password)
    db.add(current_user)
    await db.commit()
    await audit_service.log(db, company_id=current_user.company_id, user_id=current_user.id, action="Password Changed", request=request)
    return MessageResponse(message="Password updated successfully")
