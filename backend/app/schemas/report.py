from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, time
from uuid import UUID
from app.models.report import ReportType, ReportFrequency, ReportFormat, ReportExecutionStatus


class ReportFilterBase(BaseModel):
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    product_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    brand: Optional[str] = None
    customer_id: Optional[UUID] = None
    sales_status: Optional[str] = None
    stock_status: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    sales_channel: Optional[str] = None
    movement_type: Optional[str] = None
    search: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class ScheduledReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    report_type: ReportType
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    frequency: ReportFrequency
    execution_time: time
    recipients: List[str] = Field(default_factory=list, min_length=1)
    export_format: ReportFormat = ReportFormat.CSV
    is_active: bool = True


class ScheduledReportUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    report_type: Optional[ReportType] = None
    filters: Optional[Dict[str, Any]] = None
    frequency: Optional[ReportFrequency] = None
    execution_time: Optional[time] = None
    recipients: Optional[List[str]] = None
    export_format: Optional[ReportFormat] = None
    is_active: Optional[bool] = None


class ScheduledReportResponse(BaseModel):
    id: UUID
    company_id: UUID
    created_by: Optional[UUID] = None
    name: str
    report_type: ReportType
    filters: Dict[str, Any]
    frequency: ReportFrequency
    execution_time: time
    recipients: List[str]
    export_format: ReportFormat
    is_active: bool
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportHistoryResponse(BaseModel):
    id: UUID
    company_id: UUID
    scheduled_report_id: Optional[UUID] = None
    generated_by: Optional[UUID] = None
    report_name: str
    report_type: ReportType
    filters: Dict[str, Any]
    export_format: ReportFormat
    status: ReportExecutionStatus
    error_message: Optional[str] = None
    generated_at: datetime

    model_config = {"from_attributes": True}


class ReportHistoryListResponse(BaseModel):
    items: List[ReportHistoryResponse]
    total: int
    page: int
    page_size: int


class ScheduledReportListResponse(BaseModel):
    items: List[ScheduledReportResponse]
    total: int
    page: int
    page_size: int


class ReportGenerateRequest(BaseModel):
    report_type: ReportType
    filters: Optional[ReportFilterBase] = None
    export_format: ReportFormat = ReportFormat.CSV


class ReportGenerateResponse(BaseModel):
    id: UUID
    report_name: str
    report_type: ReportType
    export_format: ReportFormat
    status: ReportExecutionStatus
    generated_at: datetime
    download_url: Optional[str] = None
    error_message: Optional[str] = None


class ReportDataResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    applied_filters: Dict[str, Any]
    period: Optional[Dict[str, Optional[str]]] = None
