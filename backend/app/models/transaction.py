from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class TransactionChannel(str, enum.Enum):
    POS = "Departmental POS"
    ONLINE = "Online Storefront"
    KIOSK = "Express Kiosks"

class TransactionType(str, enum.Enum):
    SALE = "SALE"
    REFUND = "REFUND"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(SQLEnum(TransactionType), nullable=False, default=TransactionType.SALE)
    channel = Column(SQLEnum(TransactionChannel), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="transactions", lazy="raise_on_sql")
    product = relationship("Product", back_populates="transactions", lazy="raise_on_sql")
