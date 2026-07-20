from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from app.models.product import ProductStatus
from app.models.transaction import TransactionChannel

class MetricCard(BaseModel):
    title: str
    value: str
    desc: str

class ChannelBreakdown(BaseModel):
    name: str
    percentage: int
    value: str

class MonthlyRevenue(BaseModel):
    month: str
    revenue: float

class DashboardOverview(BaseModel):
    team_count: int
    product_count: int
    active_product_count: int
    inactive_product_count: int
    category_count: int
    total_revenue: float
    service_status: str
    monthly_revenue: List[MonthlyRevenue]
    channel_breakdown: List[ChannelBreakdown]

    model_config = {"from_attributes": True}
