from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.audit_log import AuditLog
from uuid import UUID

class CRUDAuditLog:
    async def create(self, db: AsyncSession, company_id: UUID, user_id: UUID | None, action: str, ip_address: str, browser: str, entity_name: str = "", details: str | None = None) -> AuditLog:
        log = AuditLog(
            company_id=company_id,
            user_id=user_id,
            action=action,
            entity_name=entity_name,
            details=details,
            ip_address=ip_address,
            browser=browser,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    async def list_by_company(self, db: AsyncSession, company_id: UUID, limit: int = 100) -> list[AuditLog]:
        result = await db.execute(
            select(AuditLog).where(AuditLog.company_id == company_id).order_by(AuditLog.timestamp.desc()).limit(limit)
        )
        return list(result.scalars().all())

audit_log = CRUDAuditLog()
