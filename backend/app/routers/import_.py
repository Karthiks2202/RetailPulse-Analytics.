from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import os
import logging
from uuid import UUID

from app.database import get_db
from app.models.import_history import ImportType, ImportStatus
from app.schemas.import_ import ImportHistoryResponse, ImportErrorResponse, ImportPreviewResponse, ImportResultResponse
from app.services.import_ import ImportService, ImportValidationError
from app.utils.dependencies import get_current_active_user
from app.services.audit import audit_service

logger = logging.getLogger("retailpulse")

router = APIRouter(prefix="/import", tags=["import"])


class ImportUploadResponse(BaseModel):
    import_id: UUID
    import_type: str
    filename: str
    total_records: int
    status: str


@router.post("/upload", response_model=ImportUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    import_type: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can import data")

    try:
        itype = ImportType(import_type.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid import type: {import_type}")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are allowed")

    max_size = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds 50MB limit")

    service = ImportService(db, current_user.company_id, current_user.id)
    try:
        columns, rows = service.parse_csv(content)
        service.validate_columns(itype, columns)
    except ValueError as e:
        logger.warning(f"Validation error during upload: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file format or content")

    history = await service.create_import_history(itype, file.filename, len(rows))
    await audit_service.log(db, current_user.company_id, current_user.id, "Import Uploaded", request, entity_name=file.filename, details=f"Uploaded {itype.value} import with {len(rows)} records")
    return ImportUploadResponse(
        import_id=history.id,
        import_type=itype.value,
        filename=file.filename,
        total_records=len(rows),
        status=history.status.value,
    )


@router.post("/validate", response_model=ImportPreviewResponse)
async def validate_import(
    import_type: str = Form(...),
    import_id: str = Form(None),
    file: UploadFile = File(...),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can import data")

    try:
        itype = ImportType(import_type.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid import type: {import_type}")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are allowed")

    content = await file.read()
    service = ImportService(db, current_user.company_id, current_user.id)
    parsed_id = UUID(import_id) if import_id else None
    try:
        result = await service.validate_import(itype, content, file.filename, parsed_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Validation failed")

    return ImportPreviewResponse(**result)


@router.post("/process", response_model=ImportResultResponse)
async def process_import(
    import_type: str = Form(...),
    import_id: str = Form(None),
    file: UploadFile = File(...),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can import data")

    try:
        itype = ImportType(import_type.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid import type: {import_type}")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are allowed")

    content = await file.read()
    service = ImportService(db, current_user.company_id, current_user.id)
    parsed_id = UUID(import_id) if import_id else None
    try:
        result = await service.process_import(itype, content, file.filename, parsed_id)
    except ValueError as e:
        logger.warning(f"Validation error during process: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file format or content")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Import failed")

    return ImportResultResponse(**result)


@router.get("/history", response_model=list[ImportHistoryResponse])
async def get_import_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    import_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view import history")

    itype = ImportType(import_type.upper()) if import_type else None
    istatus = ImportStatus(status.upper()) if status else None
    histories, _ = await ImportService(db, current_user.company_id, current_user.id).list_import_history(skip=skip, limit=limit, import_type=itype, status=istatus)
    output = []
    for h in histories:
        output.append(ImportHistoryResponse(
            id=h.id,
            company_id=h.company_id,
            import_type=h.import_type.value,
            filename=h.filename,
            uploaded_by=h.uploaded_by,
            uploaded_by_name=None,
            total_records=h.total_records,
            successful_records=h.successful_records,
            failed_records=h.failed_records,
            duplicate_records=h.duplicate_records,
            status=h.status.value,
            created_at=h.created_at,
            completed_at=h.completed_at,
        ))
    return output


@router.get("/{import_id}", response_model=ImportHistoryResponse)
async def get_import_detail(
    import_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view import history")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")
    return ImportHistoryResponse(
        id=history.id,
        company_id=history.company_id,
        import_type=history.import_type.value,
        filename=history.filename,
        uploaded_by=history.uploaded_by,
        uploaded_by_name=None,
        total_records=history.total_records,
        successful_records=history.successful_records,
        failed_records=history.failed_records,
        duplicate_records=history.duplicate_records,
        status=history.status.value,
        created_at=history.created_at,
        completed_at=history.completed_at,
    )


@router.get("/{import_id}/errors", response_model=list[ImportErrorResponse])
async def get_import_errors(
    import_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view import history")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")
    errors = await service.get_import_errors(import_id)
    return [ImportErrorResponse(**e) for e in errors]
