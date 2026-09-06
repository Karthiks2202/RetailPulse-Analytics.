from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class ImportStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"


class ImportType(str, enum.Enum):
    PRODUCTS = "PRODUCTS"
    CUSTOMERS = "CUSTOMERS"
    SALES = "SALES"


class ImportHistory(Base):
    __tablename__ = "import_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    import_type = Column(SQLEnum(ImportType), nullable=False, index=True)
    filename = Column(String, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    total_records = Column(Integer, nullable=False, default=0)
    successful_records = Column(Integer, nullable=False, default=0)
    failed_records = Column(Integer, nullable=False, default=0)
    duplicate_records = Column(Integer, nullable=False, default=0)
    status = Column(SQLEnum(ImportStatus), nullable=False, default=ImportStatus.PENDING, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)

    company = relationship("Company", back_populates="imports", lazy="raise_on_sql")
    uploaded_by_user = relationship("User", lazy="raise_on_sql")
    errors = relationship("ImportError", back_populates="import_history", cascade="all, delete-orphan", lazy="raise_on_sql")


class ImportError(Base):
    __tablename__ = "import_errors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    import_id = Column(UUID(as_uuid=True), ForeignKey("import_history.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    field = Column(String, nullable=True)
    error_message = Column(Text, nullable=False)
    raw_data = Column(Text, nullable=True)

    import_history = relationship("ImportHistory", back_populates="errors", lazy="raise_on_sql")
