from sqlalchemy import Column, String, Numeric, Integer, DateTime, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class SalesChannel(str, enum.Enum):
    RETAIL = "Retail Store"
    ONLINE = "Online Store"
    MARKETPLACE = "Marketplace"


class PaymentMethod(str, enum.Enum):
    CASH = "Cash"
    CARD = "Card"
    UPI = "UPI"
    BANK_TRANSFER = "Bank Transfer"


class SaleStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Sale(Base):
    __tablename__ = "sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_number = Column(String, nullable=False, index=True)
    customer_name = Column(String, nullable=True)
    sale_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    sales_channel = Column(SQLEnum(SalesChannel), nullable=False)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(SQLEnum(SaleStatus), nullable=False, default=SaleStatus.COMPLETED)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint('company_id', 'invoice_number', name='uq_sale_company_invoice'),)

    company = relationship("Company", back_populates="sales", lazy="raise_on_sql")
    created_by_user = relationship("User", back_populates="sales", lazy="raise_on_sql")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan", lazy="raise_on_sql")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), nullable=False, default=0)
    tax = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items", lazy="raise_on_sql")
    product = relationship("Product", back_populates="sale_items", lazy="raise_on_sql")
    category = relationship("Category", back_populates="sale_items", lazy="raise_on_sql")
