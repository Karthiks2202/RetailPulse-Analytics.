from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.crud.notification import notification as notification_crud
from app.schemas.notification import NotificationResponse, NotificationFilter
from app.utils.dependencies import get_current_active_user as get_current_user
from app.models.user import User, UserRole
from typing import Optional
from uuid import UUID

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _is_admin_or_analyst(user: User) -> bool:
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN)


@router.get("", response_model=dict)
async def list_notifications(
    type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    is_read: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.notification import NotificationType, NotificationPriority, NotificationResourceType

    type_enum = None
    priority_enum = None
    is_read_bool = None
    resource_type_enum = None

    if type:
        try:
            type_enum = NotificationType(type.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid notification type: {type}")

    if priority:
        try:
            priority_enum = NotificationPriority(priority.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")

    if is_read is not None:
        is_read_bool = is_read.lower() in ("true", "1", "yes")

    if resource_type:
        try:
            resource_type_enum = NotificationResourceType(resource_type.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")

    if current_user.role == UserRole.VIEWER:
        notifications, total = await notification_crud.get_all(
            db, current_user.company_id, skip=skip, limit=limit,
            type=type_enum, priority=priority_enum, is_read=is_read_bool, resource_type=resource_type_enum,
            for_user_id=current_user.id,
        )
    else:
        notifications, total = await notification_crud.get_all(
            db, current_user.company_id, skip=skip, limit=limit,
            type=type_enum, priority=priority_enum, is_read=is_read_bool, resource_type=resource_type_enum,
            for_user_id=current_user.id,
        )

    serialized_notifications = [NotificationResponse.model_validate(n).model_dump(mode='json') for n in notifications]

    return {
        "data": serialized_notifications,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await notification_crud.get_unread_count(db, current_user.company_id, for_user_id=current_user.id)
    return {"unread_count": count}


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = await notification_crud.get_by_id(db, current_user.company_id, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.user_id is not None and notification.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = await notification_crud.get_by_id(db, current_user.company_id, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.user_id is not None and notification.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification = await notification_crud.mark_as_read(db, current_user.company_id, notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


@router.patch("/read-all", response_model=dict)
async def mark_all_notifications_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await notification_crud.mark_all_as_read(db, current_user.company_id, for_user_id=current_user.id)
    return {"status": "success"}


@router.delete("/{notification_id}", response_model=dict)
async def delete_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = await notification_crud.get_by_id(db, current_user.company_id, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.user_id is not None and notification.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    await db.delete(notification)
    await db.commit()
    return {"status": "success"}


@router.post("/cleanup-expired", response_model=dict)
async def cleanup_expired_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    deleted = await notification_crud.delete_expired(db, current_user.company_id)
    return {"deleted": deleted}
