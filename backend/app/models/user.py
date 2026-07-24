from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.VIEWER)
    status = Column(SQLEnum(UserStatus), nullable=False, default=UserStatus.PENDING)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="users", lazy="raise_on_sql")
    tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan", lazy="raise_on_sql")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan", lazy="raise_on_sql")
    sales = relationship("Sale", back_populates="created_by_user", lazy="raise_on_sql")
    stock_movements = relationship("StockMovement", back_populates="user", lazy="raise_on_sql")
    inventory_adjustments = relationship("InventoryAdjustment", back_populates="adjusted_by_user", lazy="raise_on_sql")
