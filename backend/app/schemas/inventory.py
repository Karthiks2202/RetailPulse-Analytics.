from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID
from app.models.inventory import MovementType, AdjustmentType


class StockMovementBase(BaseModel):
    product_id: UUID
    movement_type: MovementType
    previous_quantity: int
    updated_quantity: int
    quantity_changed: int
    reason: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    pass


class StockMovementResponse(StockMovementBase):
    id: UUID
    company_id: UUID
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    user_id: Optional[UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryAdjustmentBase(BaseModel):
    product_id: UUID
    adjustment_type: AdjustmentType
    quantity: int
    reason: str
    remarks: Optional[str] = None


class InventoryAdjustmentCreate(InventoryAdjustmentBase):
    pass


class ReorderLevelUpdate(BaseModel):
    low_stock_threshold: int = Field(ge=0, description="Reorder level must be greater than or equal to zero")


class InventoryAdjustmentResponse(InventoryAdjustmentBase):
    id: UUID
    company_id: UUID
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    adjusted_by: Optional[UUID]
    adjusted_at: datetime

    model_config = {"from_attributes": True}


class InventoryItemResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    sku: str
    category_id: Optional[UUID]
    brand: Optional[str]
    description: Optional[str]
    unit_price: float
    cost_price: float
    stock_quantity: int
    reserved_stock: int
    available_stock: int
    low_stock_threshold: int
    stock_status: str
    unit_of_measure: str
    category_name: Optional[str] = None

    model_config = {"from_attributes": True}


class InventorySummary(BaseModel):
    total_products: int
    total_inventory_quantity: int
    low_stock_products: int
    out_of_stock_products: int
    in_stock_products: int

    model_config = {"from_attributes": True}


class InventoryCategoryBreakdown(BaseModel):
    category_name: str
    product_count: int

    model_config = {"from_attributes": True}


class InventoryStockStatusBreakdown(BaseModel):
    stock_status: str
    product_count: int

    model_config = {"from_attributes": True}
