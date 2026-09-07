from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from app.models.import_history import ImportStatus, ImportType


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
    duplicate_records: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ImportErrorResponse(BaseModel):
    id: Optional[UUID] = None
    import_id: Optional[UUID] = None
    row_number: int
    field: Optional[str] = None
    error_message: str
    raw_data: Optional[str] = None

    model_config = {"from_attributes": True}


class ImportPreviewResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    total_records: int
    columns: list[str]
    preview_rows: list[dict[str, Any]]
    valid_records: int
    invalid_records: int
    duplicate_records: int
    errors: list[ImportErrorResponse]


class ImportResultResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    total_records: int
    successful_records: int
    failed_records: int
    duplicate_records: int
    status: str
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
