from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID
from app.models.customer import CustomerStatus, CustomerType


class CustomerBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    address: str
    city: str
    state: str
    country: str
    postal_code: str
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    customer_type: CustomerType = CustomerType.RETAIL
    preferred_sales_channel: Optional[str] = None
    notes: Optional[str] = None
    status: CustomerStatus = CustomerStatus.ACTIVE


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    customer_type: Optional[CustomerType] = None
    preferred_sales_channel: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[CustomerStatus] = None


class CustomerResponse(CustomerBase):
    id: UUID
    company_id: UUID
    customer_since: datetime
    total_purchases: int = 0
    total_spent: float = 0.0
    last_purchase_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    segment: Optional[str] = None

    model_config = {"from_attributes": True}


class CustomerListItem(BaseModel):
    id: UUID
    company_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    customer_type: CustomerType
    preferred_sales_channel: Optional[str] = None
    status: CustomerStatus
    total_purchases: int = 0
    total_spent: float = 0.0
    last_purchase_date: Optional[datetime] = None
    customer_since: datetime
    segment: Optional[str] = None

    model_config = {"from_attributes": True}


class CustomerPurchaseHistoryResponse(BaseModel):
    id: UUID
    invoice_number: str
    sale_date: datetime
    sales_channel: str
    payment_method: str
    total_amount: float
    status: str
    item_count: int = 0

    model_config = {"from_attributes": True}


class CustomerFrequentProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    total_quantity_purchased: int
    total_revenue: float

    model_config = {"from_attributes": True}


class CustomerPurchaseDetailResponse(BaseModel):
    total_orders: int
    total_revenue: float
    total_quantity_purchased: int
    average_order_value: float
    first_purchase_date: Optional[datetime] = None
    last_purchase_date: Optional[datetime] = None
    frequently_purchased_products: list[CustomerFrequentProductResponse] = []
    recent_transactions: list[CustomerPurchaseHistoryResponse] = []

    model_config = {"from_attributes": True}


class CustomerAnalyticsSummary(BaseModel):
    total_customers: int
    active_customers: int
    inactive_customers: int
    new_customers_this_month: int
    total_revenue_from_customers: float
    average_customer_spend: float


class TopCustomerResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    total_purchases: int
    total_spent: float
    last_purchase_date: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NewVsReturningResponse(BaseModel):
    new_customers: int
    returning_customers: int
    new_customer_revenue: float
    returning_customer_revenue: float


class CustomerAnalyticsDashboardResponse(BaseModel):
    total_customers: int
    active_customers: int
    new_customers: int
    returning_customers: int
    average_customer_spend: float
    total_revenue: float
    average_purchase_frequency: float


class CustomerGrowthPoint(BaseModel):
    month: str
    new_customers: int


class RevenueByTypePoint(BaseModel):
    customer_type: str
    revenue: float


class LocationDistributionPoint(BaseModel):
    state: str
    count: int
    percentage: float


class SpendingDistributionResponse(BaseModel):
    buckets: dict[str, int]
    total_customers: int


class PurchaseFrequencyPoint(BaseModel):
    range: str
    customers: int


class CustomerSegmentResponse(BaseModel):
    segments: dict[str, int]
    total_segmented: int


class MonthlyAcquisitionPoint(BaseModel):
    month: str
    new_customers: int


class CustomerFavouriteResponse(BaseModel):
    id: UUID
    name: str
    sku: Optional[str] = None


class CustomerDetailedProfileResponse(BaseModel):
    id: UUID
    company_id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    customer_type: str
    preferred_sales_channel: Optional[str] = None
    notes: Optional[str] = None
    status: str
    customer_since: datetime
    created_at: datetime
    updated_at: datetime
    total_orders: int
    total_revenue: float
    average_order_value: float
    first_purchase_date: Optional[datetime] = None
    last_purchase_date: Optional[datetime] = None
    purchase_frequency: float
    favourite_category: Optional[dict] = None
    favourite_product: Optional[dict] = None
    recent_activity: list[CustomerPurchaseHistoryResponse] = []
    segment: Optional[str] = None


class CustomerTimelineResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    user_id: Optional[UUID] = None
    action: str
    details: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}
