from sqlalchemy import Column, UUID, String, Boolean, Time, JSON, DateTime, ForeignKey, Enum as SQLEnum, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class ReportType(str, enum.Enum):
    SALES = "sales"
    INVENTORY = "inventory"
    CUSTOMER = "customer"
    PRODUCT_PERFORMANCE = "product_performance"
    STOCK_MOVEMENT = "stock_movement"


class ReportFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ReportFormat(str, enum.Enum):
    CSV = "csv"
    PDF = "pdf"


class ReportExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    report_type = Column(SQLEnum(ReportType), nullable=False)
    filters = Column(JSON, nullable=False, default=dict)
    frequency = Column(SQLEnum(ReportFrequency), nullable=False)
    execution_time = Column(Time, nullable=False)
    recipients = Column(JSON, nullable=False, default=list)
    export_format = Column(SQLEnum(ReportFormat), nullable=False, default=ReportFormat.CSV)
    is_active = Column(Boolean, nullable=False, default=True)
    last_run_at = Column(DateTime, nullable=True)
    last_run_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by_user = relationship("User", foreign_keys=[created_by])


class ReportHistory(Base):
    __tablename__ = "report_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_report_id = Column(UUID(as_uuid=True), ForeignKey("scheduled_reports.id", ondelete="SET NULL"), nullable=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    report_name = Column(String, nullable=False)
    report_type = Column(SQLEnum(ReportType), nullable=False)
    filters = Column(JSON, nullable=False, default=dict)
    export_format = Column(SQLEnum(ReportFormat), nullable=False)
    file_data = Column(JSON, nullable=True)
    status = Column(SQLEnum(ReportExecutionStatus), nullable=False, default=ReportExecutionStatus.PENDING)
    error_message = Column(String, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)

    scheduled_report = relationship("ScheduledReport", foreign_keys=[scheduled_report_id])
    generated_by_user = relationship("User", foreign_keys=[generated_by])
