from sqlalchemy import select, func, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification, NotificationType, NotificationPriority, NotificationResourceType
from uuid import UUID
from datetime import datetime, timedelta


class CRUDNotification:
    async def create(self, db: AsyncSession, company_id: UUID, title: str, message: str, type: NotificationType, priority: NotificationPriority = NotificationPriority.MEDIUM, user_id: UUID | None = None, resource_type: NotificationResourceType | None = None, resource_id: UUID | None = None, expires_at: datetime | None = None, skip_duplicate_check: bool = False) -> Notification | None:
        if not skip_duplicate_check and resource_type and resource_id:
            existing = await self._find_open_alert(db, company_id, type, resource_type, resource_id, user_id)
            if existing:
                return None

        notification = Notification(
            company_id=company_id,
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            priority=priority,
            resource_type=resource_type,
            resource_id=resource_id,
            expires_at=expires_at,
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        return notification

    async def _find_open_alert(self, db: AsyncSession, company_id: UUID, type: NotificationType, resource_type: NotificationResourceType, resource_id: UUID, user_id: UUID | None = None) -> Notification | None:
        query = select(Notification).where(
            Notification.company_id == company_id,
            Notification.type == type,
            Notification.resource_type == resource_type,
            Notification.resource_id == resource_id,
            Notification.is_read == False,
            or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.utcnow(),
            ),
        )
        if user_id is not None:
            query = query.where(Notification.user_id == user_id)
        else:
            query = query.where(Notification.user_id.is_(None))
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_all(self, db: AsyncSession, company_id: UUID, skip: int = 0, limit: int = 50, type: NotificationType | None = None, priority: NotificationPriority | None = None, is_read: bool | None = None, resource_type: NotificationResourceType | None = None, for_user_id: UUID | None = None) -> tuple[list[Notification], int]:
        query = select(Notification).where(Notification.company_id == company_id)
        if for_user_id is not None:
            query = query.where(
                or_(
                    Notification.user_id == for_user_id,
                    Notification.user_id.is_(None),
                )
            )

        if type is not None:
            query = query.where(Notification.type == type)
        if priority is not None:
            query = query.where(Notification.priority == priority)
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
        if resource_type is not None:
            query = query.where(Notification.resource_type == resource_type)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def get_by_id(self, db: AsyncSession, company_id: UUID, notification_id: UUID) -> Notification | None:
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.company_id == company_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_unread_count(self, db: AsyncSession, company_id: UUID, for_user_id: UUID | None = None) -> int:
        query = select(func.count(Notification.id)).where(
            Notification.company_id == company_id,
            Notification.is_read == False,
            or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.utcnow(),
            ),
        )
        if for_user_id is not None:
            query = query.where(
                or_(
                    Notification.user_id == for_user_id,
                    Notification.user_id.is_(None),
                )
            )
        result = await db.execute(query)
        return result.scalar() or 0

    async def mark_as_read(self, db: AsyncSession, company_id: UUID, notification_id: UUID, user_id: UUID | None = None) -> Notification | None:
        notification = await self.get_by_id(db, company_id, notification_id)
        if not notification:
            return None
        if notification.user_id is not None and user_id is not None and notification.user_id != user_id:
            return None
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            await db.commit()
            await db.refresh(notification)
        return notification

    async def mark_all_as_read(self, db: AsyncSession, company_id: UUID, for_user_id: UUID | None = None) -> None:
        query = update(Notification).where(
            Notification.company_id == company_id,
            Notification.is_read == False,
        )
        if for_user_id is not None:
            query = query.where(Notification.user_id == for_user_id)
        query = query.values(is_read=True, read_at=datetime.utcnow())
        await db.execute(query)
        await db.commit()

    async def delete_expired(self, db: AsyncSession, company_id: UUID | None = None) -> int:
        now = datetime.utcnow()
        query = select(Notification).where(Notification.expires_at.is_not(None), Notification.expires_at <= now)
        if company_id:
            query = query.where(Notification.company_id == company_id)
        result = await db.execute(query)
        expired = list(result.scalars().all())
        for n in expired:
            await db.delete(n)
        await db.commit()
        return len(expired)

    async def resolve_open_alerts(self, db: AsyncSession, company_id: UUID, type: NotificationType, resource_type: NotificationResourceType, resource_id: UUID) -> None:
        now = datetime.utcnow()
        await db.execute(
            update(Notification)
            .where(
                Notification.company_id == company_id,
                Notification.type == type,
                Notification.resource_type == resource_type,
                Notification.resource_id == resource_id,
                Notification.is_read == False,
                Notification.expires_at.is_(None),
            )
            .values(expires_at=now)
        )
        await db.commit()


notification = CRUDNotification()
