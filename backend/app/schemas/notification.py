from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.notification import NotificationType, NotificationPriority, NotificationResourceType


class NotificationBase(BaseModel):
    title: str
    message: str
    type: NotificationType
    priority: NotificationPriority = NotificationPriority.MEDIUM
    resource_type: Optional[NotificationResourceType] = None
    resource_id: Optional[UUID] = None
    is_read: bool = False
    user_id: Optional[UUID] = None


class NotificationCreate(NotificationBase):
    company_id: UUID
    expires_at: Optional[datetime] = None


class NotificationResponse(NotificationBase):
    id: UUID
    company_id: UUID
    read_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationFilter(BaseModel):
    type: Optional[NotificationType] = None
    priority: Optional[NotificationPriority] = None
    is_read: Optional[bool] = None
    resource_type: Optional[NotificationResourceType] = None
    skip: int = 0
    limit: int = 50
