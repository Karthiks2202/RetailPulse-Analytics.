from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Form, Response, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging
from uuid import UUID
from datetime import datetime

from app.database import get_db, SessionLocal
from app.models.import_history import ImportType, ImportStatus, DuplicateStrategy
from app.schemas.import_ import (
    ImportHistoryResponse,
    ImportErrorResponse,
    ImportPreviewResponse,
    ImportResultResponse,
    ImportUploadResponse,
    ImportStatusResponse,
)
from app.services.import_ import ImportService, ImportValidationError
from app.utils.dependencies import get_current_active_user
from app.services.audit import audit_service

logger = logging.getLogger("retailpulse")

router = APIRouter(prefix="/import", tags=["import"])

# Temporary in-memory cache for uploaded file contents before processing
# Key: import_id, Value: bytes
_uploaded_files_cache: dict[UUID, bytes] = {}


async def _run_import_in_background(
    import_type: ImportType,
    file_content: bytes,
    filename: str,
    import_id: UUID,
    duplicate_strategy: str,
    company_id: UUID,
    user_id: UUID,
):
    async with SessionLocal() as db:
        service = ImportService(db, company_id, user_id)
        try:
            await service.process_import(
                import_type=import_type,
                file_content=file_content,
                filename=filename,
                import_id=import_id,
                duplicate_strategy=duplicate_strategy,
            )
        except Exception as e:
            logger.exception(f"Background import execution failed for {import_id}: {e}")
            history = await service.get_import_history(import_id)
            if history:
                await service.create_import_history
                # update status to failed
                from app.crud.import_history import import_history as crud_ih
                await crud_ih.update_status(db, history, ImportStatus.FAILED, commit=True)
        finally:
            _uploaded_files_cache.pop(import_id, None)


@router.get("/template/{import_type}")
async def download_template(
    import_type: str,
    current_user=Depends(get_current_active_user),
):
    try:
        itype = ImportType(import_type.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid import type: {import_type}")

    content, filename = ImportService.get_template_csv(itype)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/upload", response_model=ImportUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    import_type: str = Form(...),
    duplicate_strategy: Optional[str] = Form("REJECT"),
    file: UploadFile = File(...),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can import data")

    try:
        itype = ImportType(import_type.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid import type: {import_type}")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files (.csv) are allowed")

    max_size = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds the 50MB limit")

    strategy = (duplicate_strategy or "REJECT").upper()
    if strategy not in ("REJECT", "SKIP", "UPDATE"):
        strategy = "REJECT"

    service = ImportService(db, current_user.company_id, current_user.id)
    try:
        columns, rows = service.parse_csv(content)
        service.validate_columns(itype, columns)
    except ValueError as e:
        logger.warning(f"Validation error during upload: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    history = await service.create_import_history(itype, file.filename, len(rows), duplicate_strategy=strategy)
    _uploaded_files_cache[history.id] = content

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Import Uploaded",
        request,
        resource_type="Import",
        resource_id=history.id,
        description=f"Uploaded {itype.value} file '{file.filename}' with {len(rows)} records (duplicate strategy: {strategy})"
    )

    return ImportUploadResponse(
        import_id=history.id,
        import_type=itype.value,
        filename=file.filename,
        total_records=len(rows),
        status=history.status.value,
        duplicate_strategy=strategy,
    )


@router.post("/validate", response_model=ImportPreviewResponse)
async def validate_import(
    import_type: str = Form(...),
    import_id: Optional[str] = Form(None),
    duplicate_strategy: Optional[str] = Form("REJECT"),
    file: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can import data")

    try:
        itype = ImportType(import_type.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid import type: {import_type}")

    strategy = (duplicate_strategy or "REJECT").upper()
    if strategy not in ("REJECT", "SKIP", "UPDATE"):
        strategy = "REJECT"

    parsed_id = UUID(import_id) if import_id else None
    content: Optional[bytes] = None
    filename = "upload.csv"

    if file and file.filename:
        filename = file.filename
        content = await file.read()
    elif parsed_id and parsed_id in _uploaded_files_cache:
        content = _uploaded_files_cache[parsed_id]
        service = ImportService(db, current_user.company_id, current_user.id)
        hist = await service.get_import_history(parsed_id)
        if hist:
            filename = hist.filename

    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file or cached upload content provided for validation")

    service = ImportService(db, current_user.company_id, current_user.id)
    result = await service.validate_import(itype, content, filename, parsed_id, duplicate_strategy=strategy)
    return ImportPreviewResponse(**result)


@router.post("/process", response_model=ImportResultResponse)
async def process_import(
    request: Request,
    background_tasks: BackgroundTasks,
    import_type: str = Form(...),
    import_id: Optional[str] = Form(None),
    duplicate_strategy: Optional[str] = Form("REJECT"),
    background: bool = Query(False),
    file: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can import data")

    try:
        itype = ImportType(import_type.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid import type: {import_type}")

    strategy = (duplicate_strategy or "REJECT").upper()
    if strategy not in ("REJECT", "SKIP", "UPDATE"):
        strategy = "REJECT"

    parsed_id = UUID(import_id) if import_id else None
    content: Optional[bytes] = None
    filename = "import.csv"

    if file and file.filename:
        filename = file.filename
        content = await file.read()
    elif parsed_id and parsed_id in _uploaded_files_cache:
        content = _uploaded_files_cache[parsed_id]
        service = ImportService(db, current_user.company_id, current_user.id)
        hist = await service.get_import_history(parsed_id)
        if hist:
            filename = hist.filename

    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File content is required for processing")

    service = ImportService(db, current_user.company_id, current_user.id)

    # Log Import Started in Audit Log
    history = None
    if parsed_id:
        history = await service.get_import_history(parsed_id)
    if not history:
        columns, rows = service.parse_csv(content)
        history = await service.create_import_history(itype, filename, len(rows), duplicate_strategy=strategy)

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Import Started",
        request,
        resource_type="Import",
        resource_id=history.id,
        description=f"Started {itype.value} import for '{filename}'"
    )

    if background:
        background_tasks.add_task(
            _run_import_in_background,
            itype,
            content,
            filename,
            history.id,
            strategy,
            current_user.company_id,
            current_user.id,
        )
        return ImportResultResponse(
            import_id=history.id,
            import_type=itype.value,
            filename=filename,
            total_records=history.total_records,
            successful_records=0,
            failed_records=0,
            skipped_records=0,
            duplicate_records=0,
            status=ImportStatus.PROCESSING.value,
            duration_seconds=0.0,
            errors=[],
        )

    try:
        result = await service.process_import(itype, content, filename, history.id, duplicate_strategy=strategy)
    except ValueError as e:
        logger.warning(f"Validation error during process: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Import process failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Import processing failed")
    finally:
        _uploaded_files_cache.pop(history.id, None)

    # Log outcome in Audit Log
    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        f"Import Completed: {result['status']}",
        request,
        resource_type="Import",
        resource_id=history.id,
        description=f"Import of '{filename}' finished with status {result['status']} (Success: {result['successful_records']}, Failed: {result['failed_records']}, Skipped: {result['skipped_records']}, Duplicates: {result['duplicate_records']})"
    )

    return ImportResultResponse(**result)


@router.post("/{import_id}/start")
async def start_import(
    import_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can import data")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    content = _uploaded_files_cache.get(import_id)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cached upload file expired or missing. Please upload the file again.")

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Import Started",
        request,
        resource_type="Import",
        resource_id=history.id,
        description=f"Started processing import {history.id} ({history.filename})"
    )

    background_tasks.add_task(
        _run_import_in_background,
        history.import_type,
        content,
        history.filename,
        history.id,
        history.duplicate_strategy or "REJECT",
        current_user.company_id,
        current_user.id,
    )

    return {
        "import_id": str(history.id),
        "status": ImportStatus.PROCESSING.value,
        "message": "Import job started in background",
    }


@router.get("/{import_id}/status", response_model=ImportStatusResponse)
async def get_import_status(
    import_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can check import status")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    processed = (history.successful_records or 0) + (history.failed_records or 0) + (history.skipped_records or 0)
    total = history.total_records or 1
    percentage = min(100, int((processed / total) * 100)) if total > 0 else 0

    return ImportStatusResponse(
        import_id=history.id,
        import_type=history.import_type.value,
        filename=history.filename,
        status=history.status.value,
        total_records=history.total_records or 0,
        processed_records=processed,
        successful_records=history.successful_records or 0,
        failed_records=history.failed_records or 0,
        skipped_records=history.skipped_records or 0,
        duplicate_records=history.duplicate_records or 0,
        progress_percentage=percentage,
        started_at=history.started_at,
        completed_at=history.completed_at,
        duration_seconds=history.duration_seconds,
    )


@router.post("/{import_id}/cancel")
async def cancel_import(
    import_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can cancel imports")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    if history.status != ImportStatus.PROCESSING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot cancel import with status '{history.status.value}'")

    ImportService.cancel_import(import_id)

    # Immediately update status to CANCELLED in database
    from app.crud.import_history import import_history as crud_ih
    history = await crud_ih.update_status(db, history, ImportStatus.CANCELLED, commit=True)

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Import Cancelled",
        request,
        resource_type="Import",
        resource_id=history.id,
        description=f"Import of '{history.filename}' was cancelled by admin"
    )

    return {
        "import_id": str(history.id),
        "status": ImportStatus.CANCELLED.value,
        "message": "Import cancellation requested",
    }


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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can view import history")

    itype = ImportType(import_type.upper()) if import_type else None
    istatus = ImportStatus(status.upper()) if status else None
    histories, _ = await ImportService(db, current_user.company_id, current_user.id).list_import_history(skip=skip, limit=limit, import_type=itype, status=istatus)
    output = []
    for h in histories:
        user_name = None
        if h.uploaded_by_user:
            user_name = h.uploaded_by_user.name
        output.append(ImportHistoryResponse(
            id=h.id,
            company_id=h.company_id,
            import_type=h.import_type.value,
            filename=h.filename,
            uploaded_by=h.uploaded_by,
            uploaded_by_name=user_name,
            total_records=h.total_records,
            successful_records=h.successful_records,
            failed_records=h.failed_records,
            skipped_records=h.skipped_records or 0,
            duplicate_records=h.duplicate_records,
            status=h.status.value,
            duplicate_strategy=h.duplicate_strategy or "REJECT",
            created_at=h.created_at,
            started_at=h.started_at,
            completed_at=h.completed_at,
            duration_seconds=h.duration_seconds,
        ))
    return output


@router.get("/{import_id}", response_model=ImportHistoryResponse)
async def get_import_detail(
    import_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can view import history")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    user_name = history.uploaded_by_user.name if history.uploaded_by_user else None

    return ImportHistoryResponse(
        id=history.id,
        company_id=history.company_id,
        import_type=history.import_type.value,
        filename=history.filename,
        uploaded_by=history.uploaded_by,
        uploaded_by_name=user_name,
        total_records=history.total_records,
        successful_records=history.successful_records,
        failed_records=history.failed_records,
        skipped_records=history.skipped_records or 0,
        duplicate_records=history.duplicate_records,
        status=history.status.value,
        duplicate_strategy=history.duplicate_strategy or "REJECT",
        created_at=history.created_at,
        started_at=history.started_at,
        completed_at=history.completed_at,
        duration_seconds=history.duration_seconds,
    )


@router.get("/{import_id}/errors", response_model=list[ImportErrorResponse])
async def get_import_errors(
    import_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can view import errors")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    errors = await service.get_import_errors(import_id)
    return [ImportErrorResponse(**e) for e in errors]


@router.get("/{import_id}/errors/download")
async def download_error_report(
    import_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("COMPANY_ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can download error reports")

    service = ImportService(db, current_user.company_id, current_user.id)
    history = await service.get_import_history(import_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")

    errors = await service.get_import_errors(import_id)
    csv_text = ImportService.generate_error_csv(errors)

    filename = f"import-errors-{history.filename.replace('.csv', '')}-{str(import_id)[:8]}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
