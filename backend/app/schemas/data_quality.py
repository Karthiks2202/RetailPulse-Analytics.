from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from app.models.data_quality import DataQualityIssueType, DataQualityIssueSeverity, DataQualityIssueStatus, ReconciliationStatus


class DataQualityIssueBase(BaseModel):
    issue_type: DataQualityIssueType
    severity: DataQualityIssueSeverity
    status: DataQualityIssueStatus = DataQualityIssueStatus.OPEN
    affected_module: str = Field(..., min_length=1, max_length=100)
    affected_record_id: Optional[UUID] = None
    affected_record_type: Optional[str] = Field(None, max_length=100)
    description: str = Field(..., min_length=1)
    details: Optional[Dict[str, Any]] = None
    resolution_note: Optional[str] = None


class DataQualityIssueCreate(DataQualityIssueBase):
    company_id: UUID


class DataQualityIssueUpdate(BaseModel):
    status: Optional[DataQualityIssueStatus] = None
    resolution_note: Optional[str] = None
    resolved_by: Optional[UUID] = None


class DataQualityIssueResponse(DataQualityIssueBase):
    id: UUID
    company_id: UUID
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    previous_status: Optional[str] = None

    model_config = {"from_attributes": True}


class DataQualityIssueListResponse(BaseModel):
    items: List[DataQualityIssueResponse]
    total: int
    page: int
    page_size: int


class ReconciliationRunCreate(BaseModel):
    company_id: UUID
    triggered_by: Optional[UUID] = None


class ReconciliationRunResponse(BaseModel):
    id: UUID
    company_id: UUID
    triggered_by: Optional[UUID] = None
    status: ReconciliationStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_checked: int
    issues_detected: int
    issues_resolved: int
    failed_checks: int
    check_results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class ReconciliationRunListResponse(BaseModel):
    items: List[ReconciliationRunResponse]
    total: int
    page: int
    page_size: int


class DataQualityDashboard(BaseModel):
    total_records_checked: int
    valid_records: int
    records_with_warnings: int
    records_with_errors: int
    unresolved_issues: int
    last_reconciliation_time: Optional[datetime] = None
    total_issues: int = 0
    resolved_issues: int = 0


class ReconcileRequest(BaseModel):
    company_id: Optional[UUID] = None
    triggered_by: Optional[UUID] = None


class ReconcileResult(BaseModel):
    run_id: UUID
    status: ReconciliationStatus
    records_checked: int
    issues_detected: int
    issues_resolved: int
    failed_checks: int
    error_message: Optional[str] = None
    check_results: Optional[Dict[str, Any]] = None
