from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class AdjustmentType(str, enum.Enum):
    STOCK_IN = "STOCK_IN"
    STOCK_OUT = "STOCK_OUT"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"


class MovementType(str, enum.Enum):
    SALE = "SALE"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    STOCK_ADDITION = "STOCK_ADDITION"
    STOCK_REMOVAL = "STOCK_REMOVAL"


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(SQLEnum(MovementType), nullable=False)
    previous_quantity = Column(Integer, nullable=False)
    updated_quantity = Column(Integer, nullable=False)
    quantity_changed = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    company = relationship("Company", back_populates="stock_movements", lazy="raise_on_sql")
    product = relationship("Product", back_populates="stock_movements", lazy="raise_on_sql")
    user = relationship("User", back_populates="stock_movements", lazy="raise_on_sql")


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    adjustment_type = Column(SQLEnum(AdjustmentType), nullable=False)
    quantity = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    remarks = Column(String, nullable=True)
    adjusted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    adjusted_at = Column(DateTime, default=datetime.utcnow, index=True)

    company = relationship("Company", back_populates="inventory_adjustments", lazy="raise_on_sql")
    product = relationship("Product", back_populates="inventory_adjustments", lazy="raise_on_sql")
    adjusted_by_user = relationship("User", back_populates="inventory_adjustments", lazy="raise_on_sql")
