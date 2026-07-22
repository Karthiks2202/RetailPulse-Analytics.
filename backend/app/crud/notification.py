from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.models.notification import Notification, NotificationType
from uuid import UUID

class CRUDNotification:
    async def create(self, db: AsyncSession, company_id: UUID, title: str, message: str, type: NotificationType, user_id: UUID | None = None) -> Notification:
        notification = Notification(
            company_id=company_id,
            user_id=user_id,
            title=title,
            message=message,
            type=type
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        return notification

    async def get_all(self, db: AsyncSession, company_id: UUID, skip: int = 0, limit: int = 50) -> tuple[list[Notification], int]:
        query = select(Notification).where(Notification.company_id == company_id).order_by(Notification.created_at.desc())
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def get_unread_count(self, db: AsyncSession, company_id: UUID) -> int:
        query = select(func.count(Notification.id)).where(Notification.company_id == company_id).where(Notification.is_read == False)
        result = await db.execute(query)
        return result.scalar() or 0

    async def mark_as_read(self, db: AsyncSession, company_id: UUID, notification_id: UUID) -> Notification | None:
        notification = await db.get(Notification, notification_id)
        if notification and notification.company_id == company_id:
            notification.is_read = True
            await db.commit()
            await db.refresh(notification)
            return notification
        return None
        
    async def mark_all_as_read(self, db: AsyncSession, company_id: UUID) -> None:
        await db.execute(
            update(Notification)
            .where(Notification.company_id == company_id)
            .where(Notification.is_read == False)
            .values(is_read=True)
        )
        await db.commit()

notification = CRUDNotification()
