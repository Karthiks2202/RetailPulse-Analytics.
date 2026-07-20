from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID
from app.models.category import CategoryStatus

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: CategoryStatus = CategoryStatus.ACTIVE

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CategoryStatus] = None

class CategoryResponse(CategoryBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    product_count: int = 0

    model_config = {"from_attributes": True}
