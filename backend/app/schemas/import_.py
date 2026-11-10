from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any
from uuid import UUID


class ImportHistoryResponse(BaseModel):
    id: UUID
    company_id: UUID
    import_type: str
    filename: str
    uploaded_by: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    total_records: int
    successful_records: int
    failed_records: int
    skipped_records: int = 0
    duplicate_records: int
    status: str
    duplicate_strategy: Optional[str] = "REJECT"
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None

    model_config = {"from_attributes": True}


class ImportErrorResponse(BaseModel):
    id: Optional[UUID] = None
    import_id: Optional[UUID] = None
    row_number: int
    field: Optional[str] = None
    error_type: Optional[str] = "VALIDATION_ERROR"
    error_message: str
    raw_data: Optional[str] = None
    processing_status: Optional[str] = "FAILED"

    model_config = {"from_attributes": True}


class ImportPreviewResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    duplicate_strategy: Optional[str] = "REJECT"
    total_records: int
    columns: list[str]
    preview_rows: list[dict[str, Any]]
    valid_records: int
    invalid_records: int
    duplicate_records: int
    errors: list[ImportErrorResponse]
    status: str


class ImportStatusResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    status: str
    total_records: int
    processed_records: int
    successful_records: int
    failed_records: int
    skipped_records: int
    duplicate_records: int
    progress_percentage: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None


class ImportResultResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    total_records: int
    successful_records: int
    failed_records: int
    skipped_records: int = 0
    duplicate_records: int
    status: str
    duration_seconds: Optional[float] = None
    reconciliation_run: Optional[dict[str, Any]] = None
    errors: list[ImportErrorResponse]


class ImportProcessResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    total_records: int
    successful_records: int
    failed_records: int
    duplicate_records: int
    status: str
    errors: list[dict[str, Any]]


class ImportUploadResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    total_records: int
    status: str
    duplicate_strategy: Optional[str] = "REJECT"
