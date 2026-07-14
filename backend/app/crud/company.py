from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.company import Company
from app.schemas.company import CompanyCreate
from uuid import UUID

class CRUDCompany:
    async def get_by_id(self, db: AsyncSession, company_id: UUID) -> Company | None:
        result = await db.execute(select(Company).where(Company.id == company_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, db: AsyncSession, email: str) -> Company | None:
        result = await db.execute(select(Company).where(Company.email == email))
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, obj_in: CompanyCreate) -> Company:
        company = Company(**obj_in.model_dump())
        db.add(company)
        await db.commit()
        await db.refresh(company)
        return company

company = CRUDCompany()
