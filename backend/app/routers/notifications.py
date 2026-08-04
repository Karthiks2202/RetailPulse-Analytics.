from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.crud.notification import notification as notification_crud
from app.schemas.notification import NotificationResponse
from app.utils.dependencies import get_current_active_user as get_current_user
from app.models.user import User
from typing import List
from uuid import UUID

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("", response_model=dict)
async def list_notifications(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications, total = await notification_crud.get_all(
        db, current_user.company_id, skip=skip, limit=limit
    )
    
    serialized_notifications = [NotificationResponse.model_validate(n).model_dump(mode='json') for n in notifications]
    
    return {
        "data": serialized_notifications,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await notification_crud.get_unread_count(db, current_user.company_id)
    return {"unread_count": count}

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = await notification_crud.mark_as_read(db, current_user.company_id, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return notification

@router.patch("/read-all", response_model=dict)
async def mark_all_notifications_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await notification_crud.mark_all_as_read(db, current_user.company_id)
    return {"status": "success"}
