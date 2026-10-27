from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Text, JSON, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class DataQualityIssueType(str, enum.Enum):
    SALE_EXCEEDS_STOCK = "sale_exceeds_stock"
    INVENTORY_INCONSISTENT_WITH_MOVEMENTS = "inventory_inconsistent_with_movements"
    SALE_REFERENCES_INACTIVE_PRODUCT = "sale_references_inactive_product"
    SALE_REFERENCES_INVALID_CUSTOMER = "sale_references_invalid_customer"
    DUPLICATE_PRODUCT_SKU = "duplicate_product_sku"
    MISSING_MANDATORY_PRODUCT_INFO = "missing_mandatory_product_info"
    MISSING_MANDATORY_CUSTOMER_INFO = "missing_mandatory_customer_info"
    STOCK_MOVEMENT_INCONSISTENT_QUANTITIES = "stock_movement_inconsistent_quantities"
    REPORT_TOTAL_MISMATCH = "report_total_mismatch"


class DataQualityIssueSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DataQualityIssueStatus(str, enum.Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class ReconciliationStatus(str, enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_ISSUES = "completed_with_issues"
    FAILED = "failed"


class DataQualityIssue(Base):
    __tablename__ = "data_quality_issues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_type = Column(SQLEnum(DataQualityIssueType), nullable=False, index=True)
    severity = Column(SQLEnum(DataQualityIssueSeverity), nullable=False, index=True)
    status = Column(SQLEnum(DataQualityIssueStatus), nullable=False, default=DataQualityIssueStatus.OPEN, index=True)
    affected_module = Column(String, nullable=False, index=True)
    affected_record_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    affected_record_type = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_note = Column(Text, nullable=True)
    previous_status = Column(String, nullable=True)
    details = Column(JSON, nullable=True)

    company = relationship("Company", back_populates="data_quality_issues", lazy="raise_on_sql")
    resolved_by_user = relationship("User", foreign_keys=[resolved_by], lazy="raise_on_sql")


class ReconciliationRun(Base):
    __tablename__ = "reconciliation_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SQLEnum(ReconciliationStatus), nullable=False, default=ReconciliationStatus.RUNNING, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    records_checked = Column(Integer, nullable=False, default=0)
    issues_detected = Column(Integer, nullable=False, default=0)
    issues_resolved = Column(Integer, nullable=False, default=0)
    failed_checks = Column(Integer, nullable=False, default=0)
    check_results = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)

    company = relationship("Company", back_populates="reconciliation_runs", lazy="raise_on_sql")
    triggered_by_user = relationship("User", foreign_keys=[triggered_by], lazy="raise_on_sql")
