from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID
from app.models.sale import SalesChannel, PaymentMethod


class AnalyticsFilters(BaseModel):
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    product_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    brand: Optional[str] = None
    sales_channel: Optional[SalesChannel] = None
    payment_method: Optional[PaymentMethod] = None


class KPICardResponse(BaseModel):
    title: str
    value: str
    change: Optional[str] = None
    trend: Optional[str] = None


class KPIDashboardResponse(BaseModel):
    total_revenue: float
    total_orders: int
    total_products_sold: int
    average_order_value: float
    total_discount: float
    total_tax: float
    total_inventory_value: float
    low_stock_products: int
    out_of_stock_products: int
    total_categories: int


class RevenueTrendPoint(BaseModel):
    period: str
    revenue: float
    orders: int


class SalesTrendPoint(BaseModel):
    period: str
    sales: float
    quantity: int


class TopProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    category_name: Optional[str]
    brand: Optional[str]
    total_quantity: int
    total_revenue: float


class TopCategoryResponse(BaseModel):
    category_id: Optional[UUID]
    category_name: str
    total_quantity: int
    total_revenue: float
    product_count: int


class PaymentMethodBreakdown(BaseModel):
    payment_method: str
    total_orders: int
    total_revenue: float
    percentage: float


class SalesChannelBreakdown(BaseModel):
    sales_channel: str
    total_orders: int
    total_revenue: float
    percentage: float


class InventoryDistributionCategory(BaseModel):
    category_id: Optional[UUID]
    category_name: str
    product_count: int
    total_stock: int
    total_value: float


class StockStatusSummary(BaseModel):
    status: str
    product_count: int
    percentage: float


class LowStockProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    category_name: Optional[str]
    brand: Optional[str]
    stock_quantity: int
    available_stock: int
    low_stock_threshold: int
    unit_price: float
    inventory_value: float


class OutOfStockProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    category_name: Optional[str]
    brand: Optional[str]
    last_sale_date: Optional[datetime]
    unit_price: float


class InventoryValueByCategory(BaseModel):
    category_id: Optional[UUID]
    category_name: str
    total_products: int
    total_stock: int
    total_cost_value: float
    total_retail_value: float


class DrillDownTransactionResponse(BaseModel):
    id: UUID
    invoice_number: str
    sale_date: datetime
    customer_name: Optional[str]
    sales_channel: str
    payment_method: str
    total_amount: float
    status: str
    items: List[dict]


class DrillDownProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    category_name: Optional[str]
    brand: Optional[str]
    stock_quantity: int
    unit_price: float
    total_sold: int
    total_revenue: float


class DrillDownCategoryProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    brand: Optional[str]
    stock_quantity: int
    available_stock: int
    unit_price: float
    cost_price: float
    low_stock_threshold: int
    stock_status: str
    total_sold: int
    total_revenue: float


class DrillDownProductTransactionResponse(BaseModel):
    id: UUID
    invoice_number: str
    sale_date: datetime
    customer_name: Optional[str]
    sales_channel: str
    payment_method: str
    total_amount: float
    status: str
    items: List[dict]


class KPIDetailResponse(BaseModel):
    transactions: List[DrillDownTransactionResponse]
    products: List[DrillDownProductResponse]
    low_stock_products: List[LowStockProductResponse]
    out_of_stock_products: List[OutOfStockProductResponse]


class ExportRequest(BaseModel):
    export_type: Literal["csv", "pdf"]
    report_type: Literal["kpis", "sales", "inventory", "transactions"]
    filters: Optional[AnalyticsFilters] = None


class AuditLogCreate(BaseModel):
    action: str
    entity_name: str = ""
    details: Optional[str] = None
    export_type: Optional[str] = None


class RefreshResponse(BaseModel):
    status: str
    timestamp: str
