from sqlalchemy import Column, String, Numeric, Integer, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class ProductStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

class UnitOfMeasure(str, enum.Enum):
    PCS = "PCS"
    KG = "KG"
    G = "G"
    L = "L"
    ML = "ML"
    BOX = "BOX"
    PACK = "PACK"
    M = "M"
    CM = "CM"

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False)
    sku = Column(String, nullable=False)
    brand = Column(String, nullable=True)
    description = Column(String, nullable=True)
    unit_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    unit_of_measure = Column(SQLEnum(UnitOfMeasure), nullable=False, default=UnitOfMeasure.PCS)
    status = Column(SQLEnum(ProductStatus), nullable=False, default=ProductStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="products")
    category = relationship("Category", back_populates="products")
    transactions = relationship("Transaction", back_populates="product")
