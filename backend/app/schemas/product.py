from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID
from app.models.product import ProductStatus, UnitOfMeasure
from app.models.category import CategoryStatus
from app.schemas.category import CategoryResponse

class ProductBase(BaseModel):
    name: str
    sku: str
    category_id: Optional[UUID] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    unit_price: float
    cost_price: float = Field(ge=0)
    stock_quantity: int = Field(ge=0)
    low_stock_threshold: int = Field(ge=0, default=5)
    unit_of_measure: UnitOfMeasure = UnitOfMeasure.PCS
    status: ProductStatus = ProductStatus.ACTIVE

class ProductCreate(ProductBase):
    unit_price: float = Field(gt=0)
    cost_price: float = Field(ge=0)

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[UUID] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    unit_price: Optional[float] = Field(default=None, gt=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    low_stock_threshold: Optional[int] = Field(default=None, ge=0)
    unit_of_measure: Optional[UnitOfMeasure] = None
    status: Optional[ProductStatus] = None

class ProductResponse(ProductBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None

    model_config = {"from_attributes": True}
