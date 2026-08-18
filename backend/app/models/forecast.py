from sqlalchemy import Column, String, Numeric, Integer, DateTime, ForeignKey, Enum as SQLEnum, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class ForecastPeriodType(str, enum.Enum):
    NEXT_7_DAYS = "NEXT_7_DAYS"
    NEXT_30_DAYS = "NEXT_30_DAYS"
    NEXT_90_DAYS = "NEXT_90_DAYS"
    CUSTOM = "CUSTOM"


class RecommendationType(str, enum.Enum):
    REORDER_SOON = "REORDER_SOON"
    OVERSTOCK_RISK = "OVERSTOCK_RISK"
    STOCK_LEVEL_HEALTHY = "STOCK_LEVEL_HEALTHY"
    IMMEDIATE_RESTOCK_REQUIRED = "IMMEDIATE_RESTOCK_REQUIRED"


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    forecast_period = Column(SQLEnum(ForecastPeriodType), nullable=False)
    forecast_start_date = Column(DateTime, nullable=True)
    forecast_end_date = Column(DateTime, nullable=True)
    predicted_demand = Column(Integer, nullable=False, default=0)
    confidence_score = Column(Numeric(5, 2), nullable=False, default=0)
    historical_sales = Column(Integer, nullable=False, default=0)
    recommendation = Column(SQLEnum(RecommendationType), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    refreshed_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="demand_forecasts", lazy="raise_on_sql")
    product = relationship("Product", back_populates="demand_forecasts", lazy="raise_on_sql")
    category = relationship("Category", lazy="raise_on_sql")
    history = relationship("ForecastHistory", back_populates="forecast", cascade="all, delete-orphan", lazy="raise_on_sql")

    __table_args__ = (UniqueConstraint("company_id", "product_id", "forecast_period", name="uq_company_product_period"),)


class ForecastHistory(Base):
    __tablename__ = "forecast_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    forecast_id = Column(UUID(as_uuid=True), ForeignKey("demand_forecasts.id", ondelete="CASCADE"), nullable=False, index=True)
    historical_sales = Column(Integer, nullable=False, default=0)
    prediction = Column(Integer, nullable=False, default=0)
    accuracy = Column(Numeric(5, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    forecast = relationship("DemandForecast", back_populates="history", lazy="raise_on_sql")
