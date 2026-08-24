from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from app.models.inventory import MovementType, AdjustmentType


class StockMovementBase(BaseModel):
    product_id: UUID
    movement_type: MovementType
    previous_quantity: int
    updated_quantity: int
    quantity_changed: int
    reason: str


class StockMovementCreate(StockMovementBase):
    pass


class StockMovementResponse(StockMovementBase):
    id: UUID
    company_id: UUID
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    user_id: Optional[UUID]
    user_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryAdjustmentBase(BaseModel):
    product_id: UUID
    adjustment_type: Optional[AdjustmentType] = None
    quantity: int
    reason: Optional[str] = None
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
    adjusted_by_name: Optional[str] = None
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


class PaginatedInventoryResponse(BaseModel):
    data: List[InventoryItemResponse]
    total: int

    model_config = {"from_attributes": True}


class PaginatedStockMovementResponse(BaseModel):
    data: List[StockMovementResponse]
    total: int

    model_config = {"from_attributes": True}


class PaginatedInventoryAdjustmentResponse(BaseModel):
    data: List[InventoryAdjustmentResponse]
    total: int

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


class InventoryForecastResponse(BaseModel):
    product_id: UUID
    product_name: str
    product_sku: str
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    brand: Optional[str] = None
    current_stock: int
    available_stock: int
    reserved_stock: int
    average_daily_sales: float
    forecasted_demand: int
    days_of_stock_remaining: float
    reorder_point: int
    recommended_reorder_quantity: int
    stock_risk: str
    recommendation: str
    confidence_score: float
    forecast_period: str
    lead_time_days: int
    safety_stock: int

    model_config = {"from_attributes": True}


class InventoryForecastListItem(BaseModel):
    product_id: UUID
    product_name: str
    product_sku: str
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    brand: Optional[str] = None
    current_stock: int
    available_stock: int
    average_daily_sales: float
    forecasted_demand: int
    days_of_stock_remaining: float
    reorder_point: int
    recommended_reorder_quantity: int
    stock_risk: str
    recommendation: str
    confidence_score: float
    forecast_period: str

    model_config = {"from_attributes": True}


class InventoryForecastSummary(BaseModel):
    total_products: int
    products_requiring_reorder: int
    products_at_stockout_risk: int
    overstocked_products: int
    healthy_products: int

    model_config = {"from_attributes": True}


class ProductRecommendationDetail(BaseModel):
    product_id: UUID
    product_name: str
    product_sku: str
    category_name: Optional[str] = None
    brand: Optional[str] = None
    current_stock: int
    available_stock: int
    average_daily_sales: float
    forecasted_demand: int
    days_of_stock_remaining: float
    reorder_point: int
    recommended_reorder_quantity: int
    stock_risk: str
    recommendation: str
    confidence_score: float
    forecast_period: str
    lead_time_days: int
    safety_stock: int
    historical_sales: int
    low_stock_threshold: int

    model_config = {"from_attributes": True}


class PaginatedInventoryForecastResponse(BaseModel):
    data: List[InventoryForecastListItem]
    total: int
    page: int
    limit: int

    model_config = {"from_attributes": True}
