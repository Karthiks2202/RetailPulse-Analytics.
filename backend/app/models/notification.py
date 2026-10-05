from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class NotificationType(str, enum.Enum):
    STOCKOUT_RISK = "STOCKOUT_RISK"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    OVERSTOCK = "OVERSTOCK"
    IMPORT_COMPLETED = "IMPORT_COMPLETED"
    IMPORT_FAILED = "IMPORT_FAILED"
    IMPORT_COMPLETED_WITH_ERRORS = "IMPORT_COMPLETED_WITH_ERRORS"
    SALES_ALERT = "SALES_ALERT"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    CUSTOMER_REGISTERED = "CUSTOMER_REGISTERED"
    VIP_STATUS = "VIP_STATUS"
    CUSTOMER_INACTIVE = "CUSTOMER_INACTIVE"
    FIRST_PURCHASE = "FIRST_PURCHASE"
    SYSTEM = "SYSTEM"


class NotificationPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class NotificationResourceType(str, enum.Enum):
    PRODUCT = "PRODUCT"
    IMPORT = "IMPORT"
    SALE = "SALE"
    SYSTEM = "SYSTEM"
    INVENTORY = "INVENTORY"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(SQLEnum(NotificationType), nullable=False, default=NotificationType.SYSTEM_ALERT, index=True)
    priority = Column(SQLEnum(NotificationPriority), nullable=False, default=NotificationPriority.MEDIUM, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    resource_type = Column(SQLEnum(NotificationResourceType), nullable=True, index=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    company = relationship("Company")
    user = relationship("User")
