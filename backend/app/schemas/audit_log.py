from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional

class AuditLogResponse(BaseModel):
    id: UUID
    company_id: UUID
    user_id: Optional[UUID]
    action: str
    ip_address: str
    browser: str
    timestamp: datetime

    model_config = {"from_attributes": True}
