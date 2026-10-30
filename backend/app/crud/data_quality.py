from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_, update
from sqlalchemy.orm import selectinload
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any, Tuple

from app.models.data_quality import DataQualityIssue, ReconciliationRun, DataQualityIssueStatus
from app.schemas.data_quality import DataQualityIssueCreate, DataQualityIssueUpdate, ReconciliationRunCreate


class CRUDDataQualityIssue:
    async def create(
        self, db: AsyncSession, obj_in: DataQualityIssueCreate
    ) -> DataQualityIssue:
        db_obj = DataQualityIssue(
            company_id=obj_in.company_id,
            issue_type=obj_in.issue_type,
            severity=obj_in.severity,
            status=obj_in.status,
            affected_module=obj_in.affected_module,
            affected_record_id=obj_in.affected_record_id,
            affected_record_type=obj_in.affected_record_type,
            description=obj_in.description,
            details=obj_in.details,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get(
        self, db: AsyncSession, issue_id: UUID, company_id: UUID
    ) -> Optional[DataQualityIssue]:
        result = await db.execute(
            select(DataQualityIssue)
            .where(DataQualityIssue.id == issue_id, DataQualityIssue.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        company_id: UUID,
        page: int = 1,
        page_size: int = 20,
        issue_type: Optional[str] = None,
        severity: Optional[str] = None,
        module: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> Tuple[List[DataQualityIssue], int]:
        query = select(DataQualityIssue).where(DataQualityIssue.company_id == company_id)

        if issue_type:
            query = query.where(DataQualityIssue.issue_type == issue_type)
        if severity:
            query = query.where(DataQualityIssue.severity == severity)
        if module:
            query = query.where(DataQualityIssue.affected_module == module)
        if status:
            query = query.where(DataQualityIssue.status == status)
        if search:
            search_ilike = f"%{search}%"
            query = query.where(
                or_(
                    DataQualityIssue.description.ilike(search_ilike),
                    DataQualityIssue.affected_module.ilike(search_ilike),
                )
            )
        if date_from:
            query = query.where(DataQualityIssue.detected_at >= date_from)
        if date_to:
            query = query.where(DataQualityIssue.detected_at <= date_to)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one() or 0

        query = (
            query.order_by(desc(DataQualityIssue.detected_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        items = result.scalars().all()
        return list(items), int(total)

    async def update_status(
        self,
        db: AsyncSession,
        issue_id: UUID,
        company_id: UUID,
        obj_in: DataQualityIssueUpdate,
    ) -> Optional[DataQualityIssue]:
        db_obj = await self.get(db, issue_id, company_id)
        if not db_obj:
            return None

        previous_status = db_obj.status.value
        update_data = obj_in.model_dump(exclude_unset=True)

        if "status" in update_data:
            db_obj.previous_status = previous_status
            new_status = update_data["status"]
            if new_status == DataQualityIssueStatus.RESOLVED:
                db_obj.resolved_at = datetime.utcnow()
                if obj_in.resolved_by:
                    db_obj.resolved_by = obj_in.resolved_by
            elif db_obj.status == DataQualityIssueStatus.RESOLVED and new_status != DataQualityIssueStatus.RESOLVED:
                # If reopening/resolving differently
                pass
        else:
            new_status = db_obj.status

        if obj_in.resolution_note is not None:
            db_obj.resolution_note = obj_in.resolution_note

        for field, value in update_data.items():
            if field == "resolved_by" and value is not None:
                db_obj.resolved_by = value
            elif field == "status":
                db_obj.status = value
            else:
                setattr(db_obj, field, value)

        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_unresolved_count(self, db: AsyncSession, company_id: UUID) -> int:
        result = await db.execute(
            select(func.count(DataQualityIssue.id)).where(
                DataQualityIssue.company_id == company_id,
                DataQualityIssue.status != DataQualityIssueStatus.RESOLVED,
                DataQualityIssue.status != DataQualityIssueStatus.IGNORED,
            )
        )
        return int(result.scalar_one() or 0)

    async def get_by_type_and_record(
        self,
        db: AsyncSession,
        company_id: UUID,
        issue_type: str,
        affected_record_id: UUID,
    ) -> Optional[DataQualityIssue]:
        result = await db.execute(
            select(DataQualityIssue).where(
                DataQualityIssue.company_id == company_id,
                DataQualityIssue.issue_type == issue_type,
                DataQualityIssue.affected_record_id == affected_record_id,
                DataQualityIssue.status.in_([
                    DataQualityIssueStatus.OPEN,
                    DataQualityIssueStatus.INVESTIGATING,
                ]),
            )
        )
        return result.scalar_one_or_none()


class CRUDReconciliationRun:
    async def create(
        self, db: AsyncSession, obj_in: ReconciliationRunCreate
    ) -> ReconciliationRun:
        db_obj = ReconciliationRun(
            company_id=obj_in.company_id,
            triggered_by=obj_in.triggered_by,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get(
        self, db: AsyncSession, run_id: UUID, company_id: UUID
    ) -> Optional[ReconciliationRun]:
        result = await db.execute(
            select(ReconciliationRun)
            .where(ReconciliationRun.id == run_id, ReconciliationRun.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        company_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[ReconciliationRun], int]:
        query = select(ReconciliationRun).where(ReconciliationRun.company_id == company_id)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one() or 0

        query = (
            query.order_by(desc(ReconciliationRun.started_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        items = result.scalars().all()
        return list(items), int(total)

    async def update(
        self,
        db: AsyncSession,
        run_id: UUID,
        company_id: UUID,
        **kwargs,
    ) -> Optional[ReconciliationRun]:
        db_obj = await self.get(db, run_id, company_id)
        if not db_obj:
            return None
        for field, value in kwargs.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj


data_quality_issue = CRUDDataQualityIssue()
reconciliation_run = CRUDReconciliationRun()
