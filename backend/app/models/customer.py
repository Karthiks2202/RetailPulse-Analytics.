from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Enum as SQLEnum, UniqueConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class CustomerStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class CustomerType(str, enum.Enum):
    RETAIL = "RETAIL"
    WHOLESALE = "WHOLESALE"
    CORPORATE = "CORPORATE"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=True, index=True)
    phone = Column(String, nullable=True)
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True, index=True)
    state = Column(String, nullable=True, index=True)
    country = Column(String, nullable=True, index=True)
    postal_code = Column(String, nullable=True)
    customer_type = Column(SQLEnum(CustomerType), nullable=False, default=CustomerType.RETAIL, index=True)
    preferred_sales_channel = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    customer_since = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(SQLEnum(CustomerStatus), nullable=False, default=CustomerStatus.ACTIVE, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint('company_id', 'email', name='uq_customer_company_email'),
        UniqueConstraint('company_id', 'phone', name='uq_customer_company_phone'),
    )

    company = relationship("Company", back_populates="customers", lazy="raise_on_sql")
    sales = relationship("Sale", back_populates="customer", lazy="raise_on_sql")
    timelines = relationship("CustomerTimeline", back_populates="customer", cascade="all, delete-orphan", lazy="raise_on_sql")
