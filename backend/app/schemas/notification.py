from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.notification import NotificationType

class NotificationBase(BaseModel):
    title: str
    message: str
    type: NotificationType
    is_read: bool = False
    user_id: Optional[UUID] = None

class NotificationCreate(NotificationBase):
    company_id: UUID

class NotificationResponse(NotificationBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
