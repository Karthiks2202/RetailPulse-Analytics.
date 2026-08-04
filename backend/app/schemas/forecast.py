from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID
from app.models.forecast import ForecastPeriodType, RecommendationType


class ForecastGenerateRequest(BaseModel):
    forecast_period: ForecastPeriodType
    forecast_start_date: Optional[datetime] = None
    forecast_end_date: Optional[datetime] = None


class DemandForecastResponse(BaseModel):
    id: UUID
    company_id: UUID
    product_id: UUID
    category_id: Optional[UUID]
    forecast_period: ForecastPeriodType
    forecast_start_date: Optional[datetime]
    forecast_end_date: Optional[datetime]
    predicted_demand: int
    confidence_score: float
    historical_sales: int
    recommendation: Optional[RecommendationType]
    generated_at: datetime
    refreshed_at: datetime

    model_config = {"from_attributes": True}


class DemandForecastListItem(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    product_sku: str
    category_id: Optional[UUID]
    category_name: Optional[str]
    brand: Optional[str]
    current_stock: int
    historical_sales: int
    predicted_demand: int
    forecast_period: ForecastPeriodType
    confidence_score: float
    recommendation: Optional[RecommendationType]
    generated_at: datetime

    model_config = {"from_attributes": True}


class CategoryForecastResponse(BaseModel):
    id: str
    category_id: Optional[UUID]
    category_name: str
    total_historical_sales: int
    predicted_demand: int
    expected_growth_percentage: float
    forecast_period: ForecastPeriodType
    generated_at: datetime

    model_config = {"from_attributes": True}


class ForecastKPIsResponse(BaseModel):
    total_predicted_demand: int
    products_expected_to_run_out: int
    high_growth_products: int
    slow_moving_products: int
    forecast_accuracy: float


class ForecastHistoryResponse(BaseModel):
    id: UUID
    forecast_id: UUID
    historical_sales: int
    prediction: int
    accuracy: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


class ForecastExportResponse(BaseModel):
    content: str
    filename: str
    content_type: str
