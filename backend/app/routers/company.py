from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.company import Company
from app.schemas.company import CompanyResponse
from app.utils.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/companies", tags=["companies"])

@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(company_id, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    from uuid import UUID
    try:
        cid = UUID(company_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid company id")

    if current_user.company_id != cid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Resource belongs to another company")

    result = await db.execute(select(Company).where(Company.id == cid))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company
