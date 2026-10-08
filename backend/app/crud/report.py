from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, List, Dict, Any
from app.models.report import ScheduledReport, ReportHistory, ReportExecutionStatus, ReportFrequency
from app.schemas.report import ScheduledReportCreate, ScheduledReportUpdate


class CRUDReport:
    async def create_scheduled_report(self, db: AsyncSession, obj_in: ScheduledReportCreate, company_id: UUID, created_by: UUID) -> ScheduledReport:
        db_obj = ScheduledReport(
            company_id=company_id,
            created_by=created_by,
            name=obj_in.name,
            report_type=obj_in.report_type,
            filters=obj_in.filters or {},
            frequency=obj_in.frequency,
            execution_time=obj_in.execution_time,
            recipients=obj_in.recipients,
            export_format=obj_in.export_format,
            is_active=obj_in.is_active,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_scheduled_report(self, db: AsyncSession, report_id: UUID, company_id: UUID) -> Optional[ScheduledReport]:
        result = await db.execute(
            select(ScheduledReport).where(ScheduledReport.id == report_id, ScheduledReport.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def list_scheduled_reports(
        self, db: AsyncSession, company_id: UUID, page: int = 1, page_size: int = 20, is_active: Optional[bool] = None
    ) -> tuple[List[ScheduledReport], int]:
        query = select(ScheduledReport).where(ScheduledReport.company_id == company_id)
        if is_active is not None:
            query = query.where(ScheduledReport.is_active == is_active)
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one() or 0
        query = query.order_by(desc(ScheduledReport.created_at)).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        return list(items), int(total)

    async def update_scheduled_report(
        self, db: AsyncSession, report_id: UUID, company_id: UUID, obj_in: ScheduledReportUpdate
    ) -> Optional[ScheduledReport]:
        db_obj = await self.get_scheduled_report(db, report_id, company_id)
        if not db_obj:
            return None
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db_obj.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete_scheduled_report(self, db: AsyncSession, report_id: UUID, company_id: UUID) -> bool:
        db_obj = await self.get_scheduled_report(db, report_id, company_id)
        if not db_obj:
            return False
        await db.delete(db_obj)
        await db.commit()
        return True

    async def create_report_history(
        self,
        db: AsyncSession,
        company_id: UUID,
        report_name: str,
        report_type: str,
        filters: Dict[str, Any],
        export_format: str,
        generated_by: Optional[UUID] = None,
        scheduled_report_id: Optional[UUID] = None,
        status: ReportExecutionStatus = ReportExecutionStatus.PENDING,
        error_message: Optional[str] = None,
    ) -> ReportHistory:
        db_obj = ReportHistory(
            company_id=company_id,
            scheduled_report_id=scheduled_report_id,
            generated_by=generated_by,
            report_name=report_name,
            report_type=report_type,
            filters=filters,
            export_format=export_format,
            status=status,
            error_message=error_message,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update_report_history(
        self,
        db: AsyncSession,
        history_id: UUID,
        status: ReportExecutionStatus,
        file_data: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Optional[ReportHistory]:
        result = await db.execute(select(ReportHistory).where(ReportHistory.id == history_id))
        db_obj = result.scalar_one_or_none()
        if not db_obj:
            return None
        db_obj.status = status
        if file_data is not None:
            db_obj.file_data = file_data
        if error_message is not None:
            db_obj.error_message = error_message
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_report_history(self, db: AsyncSession, history_id: UUID, company_id: UUID) -> Optional[ReportHistory]:
        result = await db.execute(
            select(ReportHistory).where(ReportHistory.id == history_id, ReportHistory.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def list_report_history(
        self, db: AsyncSession, company_id: UUID, page: int = 1, page_size: int = 20, report_type: Optional[str] = None
    ) -> tuple[List[ReportHistory], int]:
        query = select(ReportHistory).where(ReportHistory.company_id == company_id)
        if report_type:
            query = query.where(ReportHistory.report_type == report_type)
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one() or 0
        query = query.order_by(desc(ReportHistory.generated_at)).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        items = result.scalars().all()
        return list(items), int(total)

    async def get_reports_due_for_execution(self, db: AsyncSession) -> List[ScheduledReport]:
        now = datetime.utcnow()
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = (
            select(ScheduledReport)
            .where(ScheduledReport.is_active == True)
            .where(ScheduledReport.last_run_at == None)
            .order_by(ScheduledReport.created_at)
        )
        result = await db.execute(query)
        return list(result.scalars().all())


report = CRUDReport()
