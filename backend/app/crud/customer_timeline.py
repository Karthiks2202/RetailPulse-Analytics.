from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.customer_timeline import CustomerTimeline
from uuid import UUID
from datetime import datetime


class CRUDCustomerTimeline:
    async def create(
        self,
        db: AsyncSession,
        company_id: UUID,
        customer_id: UUID,
        user_id: UUID | None,
        action: str,
        details: str | None = None,
        timestamp: datetime | None = None,
    ) -> CustomerTimeline:
        entry = CustomerTimeline(
            company_id=company_id,
            customer_id=customer_id,
            user_id=user_id,
            action=action,
            details=details,
            timestamp=timestamp or datetime.utcnow(),
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        return entry

    async def list_for_customer(
        self,
        db: AsyncSession,
        company_id: UUID,
        customer_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[CustomerTimeline], int]:
        query = (
            select(CustomerTimeline)
            .where(CustomerTimeline.company_id == company_id)
            .where(CustomerTimeline.customer_id == customer_id)
        )
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(CustomerTimeline.timestamp.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def list_for_company(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 200,
        action: str | None = None,
        customer_id: UUID | None = None,
    ) -> tuple[list[CustomerTimeline], int]:
        query = select(CustomerTimeline).where(CustomerTimeline.company_id == company_id)

        if action:
            query = query.where(CustomerTimeline.action == action)

        if customer_id:
            query = query.where(CustomerTimeline.customer_id == customer_id)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(CustomerTimeline.timestamp.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total


customer_timeline = CRUDCustomerTimeline()
