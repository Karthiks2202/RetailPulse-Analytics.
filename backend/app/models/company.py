from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    industry = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
    audit_logs = relationship("AuditLog", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
    products = relationship("Product", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
    categories = relationship("Category", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
    transactions = relationship("Transaction", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
    sales = relationship("Sale", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
    stock_movements = relationship("StockMovement", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
    inventory_adjustments = relationship("InventoryAdjustment", back_populates="company", cascade="all, delete-orphan", lazy="raise_on_sql")
