from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.models.audit_log import AuditLog
from app.models.user import User
from uuid import UUID
from datetime import datetime
from typing import Optional

class CRUDAuditLog:
    async def create(self, db: AsyncSession, company_id: UUID, user_id: UUID | None, action: str, ip_address: str, user_agent: str, resource_type: str = "", resource_id: UUID | None = None, description: str | None = None, before_values: dict | None = None, after_values: dict | None = None, status: str = "SUCCESS") -> AuditLog:
        log = AuditLog(
            company_id=company_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            before_values=before_values,
            after_values=after_values,
            status=status,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    async def get(self, db: AsyncSession, log_id: UUID) -> AuditLog | None:
        result = await db.execute(select(AuditLog).where(AuditLog.id == log_id))
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 25,
        user_id: UUID | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog).options(selectinload(AuditLog.user)).where(AuditLog.company_id == company_id)

        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action.ilike(f"%{action}%"))
        if resource_type:
            query = query.where(AuditLog.resource_type.ilike(f"%{resource_type}%"))
        if status:
            query = query.where(AuditLog.status == status)
        if date_from:
            query = query.where(AuditLog.created_at >= date_from)
        if date_to:
            query = query.where(AuditLog.created_at <= date_to)
        if search:
            query = query.where(
                or_(
                    AuditLog.action.ilike(f"%{search}%"),
                    AuditLog.resource_type.ilike(f"%{search}%"),
                    AuditLog.description.ilike(f"%{search}%"),
                    AuditLog.ip_address.ilike(f"%{search}%"),
                )
            )

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        sort_column = getattr(AuditLog, sort_by, AuditLog.created_at)
        if sort_dir == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def clear_logs(self, db: AsyncSession, company_id: UUID, before_date: datetime) -> int:
        query = select(AuditLog).where(AuditLog.company_id == company_id, AuditLog.created_at < before_date)
        result = await db.execute(query)
        logs = list(result.scalars().all())
        for log in logs:
            await db.delete(log)
        await db.commit()
        return len(logs)

audit_log = CRUDAuditLog()
