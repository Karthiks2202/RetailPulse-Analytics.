from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from app.models.sale import SalesChannel, PaymentMethod, SaleStatus, PaymentStatus
from app.schemas.product import ProductResponse
from app.schemas.category import CategoryResponse


class SaleItemBase(BaseModel):
    product_id: Optional[UUID] = None
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0)
    discount: float = Field(default=0, ge=0)
    tax: float = Field(default=0, ge=0)


class SaleItemCreate(SaleItemBase):
    pass


class SaleItemUpdate(BaseModel):
    product_id: Optional[UUID] = None
    quantity: Optional[int] = Field(default=None, gt=0)
    unit_price: Optional[float] = Field(default=None, ge=0)
    discount: Optional[float] = Field(default=None, ge=0)
    tax: Optional[float] = Field(default=None, ge=0)


class SaleItemResponse(SaleItemBase):
    id: UUID
    sale_id: UUID
    category_id: Optional[UUID] = None
    total: float
    product: Optional[ProductResponse] = None
    category: Optional[CategoryResponse] = None

    model_config = {"from_attributes": True}


class SaleBase(BaseModel):
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    sale_date: Optional[datetime] = None
    sales_channel: SalesChannel
    payment_method: PaymentMethod
    payment_status: PaymentStatus = PaymentStatus.PAID
    status: SaleStatus = SaleStatus.COMPLETED
    notes: Optional[str] = None
    items: List[SaleItemCreate]


class SaleCreate(SaleBase):
    pass


class SaleUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    sale_date: Optional[datetime] = None
    sales_channel: Optional[SalesChannel] = None
    payment_method: Optional[PaymentMethod] = None
    payment_status: Optional[PaymentStatus] = None
    status: Optional[SaleStatus] = None
    notes: Optional[str] = None
    items: Optional[List[SaleItemCreate]] = None


class SaleResponse(SaleBase):
    id: UUID
    company_id: UUID
    invoice_number: str
    total_amount: float
    created_by: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[SaleItemResponse] = []

    model_config = {"from_attributes": True}


class SaleListItemResponse(BaseModel):
    id: UUID
    company_id: UUID
    invoice_number: str
    customer_name: Optional[str] = None
    sale_date: datetime
    sales_channel: SalesChannel
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    total_amount: float
    status: SaleStatus
    created_by_name: Optional[str] = None
    notes: Optional[str] = None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SaleSummaryResponse(BaseModel):
    total_sales: int
    total_revenue: float
    total_orders: int
    average_order_value: float

    model_config = {"from_attributes": True}
