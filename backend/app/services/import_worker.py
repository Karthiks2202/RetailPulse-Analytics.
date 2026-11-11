import asyncio
import logging
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import select, or_

from app.database import SessionLocal
from app.models.import_history import ImportHistory, ImportStatus
from app.crud.import_history import import_history as crud_ih
from app.services.audit import audit_service

logger = logging.getLogger("retailpulse")


class ImportJobWorker:
    def __init__(self):
        self._queue: Optional[asyncio.Queue[Dict[str, Any]]] = None
        self._worker_task: Optional[asyncio.Task] = None
        self._running: bool = False
        self._active_jobs: set[UUID] = set()

    @property
    def queue(self) -> asyncio.Queue[Dict[str, Any]]:
        if self._queue is None:
            self._queue = asyncio.Queue()
        return self._queue

    def is_running(self) -> bool:
        return self._running and self._worker_task is not None and not self._worker_task.done()

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._queue = asyncio.Queue()
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("Import background job worker started.")

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        logger.info("Import background job worker stopped.")

    async def enqueue(self, import_id: UUID, company_id: UUID, user_id: UUID | None) -> None:
        """
        Enqueues an import job for asynchronous durable background execution.
        """
        await self.queue.put({
            "import_id": import_id,
            "company_id": company_id,
            "user_id": user_id,
        })
        logger.info(f"Import job {import_id} enqueued in worker queue.")

    async def check_pending_jobs(self) -> int:
        """
        Durable job recovery: Scans database for any imports in PENDING status
        (e.g., following a server reboot) and adds them to the queue.
        """
        enqueued_count = 0
        try:
            async with SessionLocal() as db:
                result = await db.execute(
                    select(ImportHistory).where(
                        ImportHistory.status == ImportStatus.PENDING
                    ).order_by(ImportHistory.created_at.asc())
                )
                pending_imports = result.scalars().all()
                for history in pending_imports:
                    if history.id not in self._active_jobs:
                        await self.enqueue(history.id, history.company_id, history.uploaded_by)
                        enqueued_count += 1
        except Exception as e:
            logger.warning(f"Error checking for pending import jobs: {e}")
        return enqueued_count

    async def _worker_loop(self) -> None:
        while self._running:
            try:
                job = await self.queue.get()
                import_id = job["import_id"]
                company_id = job["company_id"]
                user_id = job.get("user_id")

                self._active_jobs.add(import_id)
                try:
                    await self._execute_job(import_id, company_id, user_id)
                finally:
                    self._active_jobs.discard(import_id)
                    self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Unexpected error in import worker loop: {e}")
                await asyncio.sleep(1)

    async def _execute_job(self, import_id: UUID, company_id: UUID, user_id: UUID | None) -> None:
        from app.services.import_ import ImportService

        logger.info(f"Worker beginning execution of import job {import_id} (company={company_id}).")
        async with SessionLocal() as db:
            service = ImportService(db, company_id, user_id)
            history = await service.get_import_history(import_id)
            if not history:
                logger.error(f"Cannot process import {import_id}: history record not found.")
                return

            if history.status in (ImportStatus.CANCELLED, ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_ERRORS):
                logger.info(f"Import {import_id} already has terminal status {history.status.value}, skipping.")
                return

            try:
                # Execute durable processing
                result = await service.process_import_from_storage(import_id)

                # Record completion in audit log
                status_str = result.get("status", "COMPLETED")
                await audit_service.log(
                    db,
                    company_id,
                    user_id,
                    f"Import Completed: {status_str}",
                    request=None,
                    resource_type="Import",
                    resource_id=import_id,
                    description=(
                        f"Background import of '{history.filename}' finished with status {status_str} "
                        f"(Success: {result.get('successful_records', 0)}, Failed: {result.get('failed_records', 0)}, "
                        f"Skipped: {result.get('skipped_records', 0)}, Duplicates: {result.get('duplicate_records', 0)})"
                    ),
                    after_values={
                        "status": status_str,
                        "successful_records": result.get("successful_records", 0),
                        "failed_records": result.get("failed_records", 0),
                    },
                    status="SUCCESS" if status_str == "COMPLETED" else "WARNING",
                )
                logger.info(f"Import {import_id} successfully completed with status {status_str}.")

            except Exception as e:
                logger.exception(f"Background execution failed for import {import_id}: {e}")
                try:
                    # Update status to FAILED
                    await crud_ih.update_status(
                        db,
                        history,
                        status=ImportStatus.FAILED,
                        failed=history.total_records or 1,
                        completed_at=datetime.utcnow(),
                        commit=True,
                    )
                    # Record the error in import_errors
                    await crud_ih.add_error(
                        db,
                        import_id=import_id,
                        row_number=1,
                        field="System",
                        error_type="PROCESSING_ERROR",
                        error_message=f"Background import failed: {str(e)}",
                        processing_status="FAILED",
                        commit=True,
                    )
                    # Dispatched notification
                    try:
                        await service._create_import_notification(history, ImportStatus.FAILED)
                    except Exception as ne:
                        logger.warning(f"Failed to send failure notification for import {import_id}: {ne}")

                    # Record Failure in Audit Log
                    await audit_service.log(
                        db,
                        company_id,
                        user_id,
                        "Import Failed",
                        request=None,
                        resource_type="Import",
                        resource_id=import_id,
                        description=f"Background import of '{history.filename}' failed with system error: {str(e)}",
                        status="FAILURE",
                    )
                except Exception as inner_e:
                    logger.exception(f"Failed to record failure state for import {import_id}: {inner_e}")


import_worker = ImportJobWorker()
