from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from app.models.import_history import ImportHistory, ImportError, ImportStatus, ImportType


class CRUDImportHistory:
    async def create(
        self,
        db: AsyncSession,
        company_id: UUID,
        import_type: ImportType,
        filename: str,
        uploaded_by: Optional[UUID],
        total_records: int = 0,
        duplicate_strategy: str = "REJECT",
        commit: bool = True
    ) -> ImportHistory:
        history = ImportHistory(
            company_id=company_id,
            import_type=import_type,
            filename=filename,
            uploaded_by=uploaded_by,
            total_records=total_records,
            status=ImportStatus.UPLOADED,
            duplicate_strategy=duplicate_strategy,
        )
        db.add(history)
        if commit:
            await db.commit()
            await db.refresh(history)
        else:
            await db.flush()
            await db.refresh(history)
        return history

    async def get(self, db: AsyncSession, import_id: UUID, company_id: UUID) -> ImportHistory | None:
        result = await db.execute(
            select(ImportHistory)
            .options(selectinload(ImportHistory.uploaded_by_user))
            .where(ImportHistory.id == import_id, ImportHistory.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 100,
        import_type: Optional[ImportType] = None,
        status: Optional[ImportStatus] = None
    ) -> tuple[list[ImportHistory], int]:
        query = select(ImportHistory).where(ImportHistory.company_id == company_id)
        if import_type:
            query = query.where(ImportHistory.import_type == import_type)
        if status:
            query = query.where(ImportHistory.status == status)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        query = (
            query.options(selectinload(ImportHistory.uploaded_by_user))
            .order_by(ImportHistory.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def update_status(
        self,
        db: AsyncSession,
        history: ImportHistory,
        status: ImportStatus,
        successful: int = 0,
        failed: int = 0,
        duplicates: int = 0,
        skipped: int = 0,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
        duration_seconds: Optional[float] = None,
        commit: bool = True
    ) -> ImportHistory:
        history.status = status
        history.successful_records = successful
        history.failed_records = failed
        history.duplicate_records = duplicates
        history.skipped_records = skipped
        if started_at:
            history.started_at = started_at
        if completed_at:
            history.completed_at = completed_at
        elif status in (ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_ERRORS, ImportStatus.FAILED, ImportStatus.CANCELLED):
            history.completed_at = datetime.utcnow()

        if duration_seconds is not None:
            history.duration_seconds = duration_seconds
        elif history.started_at and history.completed_at:
            history.duration_seconds = max(0.0, (history.completed_at - history.started_at).total_seconds())

        db.add(history)
        if commit:
            await db.commit()
            await db.refresh(history)
        else:
            await db.flush()
            await db.refresh(history)
        return history

    async def add_error(
        self,
        db: AsyncSession,
        import_id: UUID,
        row_number: int,
        error_message: str,
        field: Optional[str] = None,
        error_type: Optional[str] = "VALIDATION_ERROR",
        raw_data: Optional[str] = None,
        processing_status: Optional[str] = "FAILED",
        commit: bool = True
    ) -> ImportError:
        error = ImportError(
            import_id=import_id,
            row_number=row_number,
            field=field,
            error_type=error_type or "VALIDATION_ERROR",
            error_message=error_message,
            raw_data=raw_data,
            processing_status=processing_status or "FAILED",
        )
        db.add(error)
        if commit:
            await db.commit()
            await db.refresh(error)
        else:
            await db.flush()
            await db.refresh(error)
        return error

    async def get_errors(self, db: AsyncSession, import_id: UUID, company_id: UUID) -> List["ImportError"]:
        result = await db.execute(
            select(ImportError)
            .join(ImportHistory, ImportError.import_id == ImportHistory.id)
            .where(ImportError.import_id == import_id, ImportHistory.company_id == company_id)
            .order_by(ImportError.row_number.asc())
        )
        return list(result.scalars().all())


import_history = CRUDImportHistory()
