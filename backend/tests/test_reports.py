import pytest
from uuid import uuid4
from datetime import datetime, timedelta, time as dt_time
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole, UserStatus
from app.models.company import Company
from app.models.report import ScheduledReport, ReportHistory, ReportType, ReportFrequency, ReportFormat, ReportExecutionStatus
from app.crud import report_crud
from app.schemas.report import ScheduledReportCreate, ScheduledReportUpdate
from app.services import report as report_service


@pytest.mark.asyncio
async def test_create_and_list_scheduled_report(db_session: AsyncSession):
    company_id = uuid4()
    user_id = uuid4()
    user = User(id=user_id, company_id=company_id, name="Test User", email="test@example.com", password="hashed", role=UserRole.COMPANY_ADMIN, status=UserStatus.ACTIVE)
    db_session.add(user)
    await db_session.commit()

    obj_in = ScheduledReportCreate(
        name="Test Daily Sales",
        report_type=ReportType.SALES,
        filters={"date_from": datetime.utcnow().isoformat()},
        frequency=ReportFrequency.DAILY,
        execution_time=dt_time(8, 0),
        recipients=["user@example.com"],
        export_format=ReportFormat.CSV,
        is_active=True,
    )
    report = await report_crud.create_scheduled_report(db_session, obj_in, company_id, user_id)
    assert report.id is not None
    assert report.name == "Test Daily Sales"
    assert report.frequency == ReportFrequency.DAILY

    items, total = await report_crud.list_scheduled_reports(db_session, company_id)
    assert total == 1
    assert len(items) == 1
    assert items[0].id == report.id


@pytest.mark.asyncio
async def test_create_and_list_report_history(db_session: AsyncSession):
    company_id = uuid4()
    history = await report_crud.create_report_history(
        db_session,
        company_id=company_id,
        report_name="Sales Report",
        report_type=ReportType.SALES.value,
        filters={},
        export_format=ReportFormat.CSV.value,
        status=ReportExecutionStatus.COMPLETED,
    )
    assert history.id is not None

    items, total = await report_crud.list_report_history(db_session, company_id)
    assert total == 1
    assert items[0].id == history.id


@pytest.mark.asyncio
async def test_update_scheduled_report(db_session: AsyncSession):
    company_id = uuid4()
    user_id = uuid4()
    user = User(id=user_id, company_id=company_id, name="Test User", email="test@example.com", password="hashed", role=UserRole.COMPANY_ADMIN, status=UserStatus.ACTIVE)
    db_session.add(user)
    await db_session.commit()

    obj_in = ScheduledReportCreate(
        name="Test Report",
        report_type=ReportType.INVENTORY,
        frequency=ReportFrequency.WEEKLY,
        execution_time=dt_time(9, 0),
        recipients=["admin@example.com"],
        export_format=ReportFormat.PDF,
    )
    report = await report_crud.create_scheduled_report(db_session, obj_in, company_id, user_id)
    updated = await report_crud.update_scheduled_report(
        db_session, report.id, company_id, ScheduledReportUpdate(name="Updated Report", is_active=False)
    )
    assert updated is not None
    assert updated.name == "Updated Report"
    assert updated.is_active is False


@pytest.mark.asyncio
async def test_delete_scheduled_report(db_session: AsyncSession):
    company_id = uuid4()
    user_id = uuid4()
    user = User(id=user_id, company_id=company_id, name="Test User", email="test@example.com", password="hashed", role=UserRole.COMPANY_ADMIN, status=UserStatus.ACTIVE)
    db_session.add(user)
    await db_session.commit()

    obj_in = ScheduledReportCreate(
        name="To Delete",
        report_type=ReportType.CUSTOMER,
        frequency=ReportFrequency.MONTHLY,
        execution_time=dt_time(10, 0),
        recipients=["admin@example.com"],
    )
    report = await report_crud.create_scheduled_report(db_session, obj_in, company_id, user_id)
    deleted = await report_crud.delete_scheduled_report(db_session, report.id, company_id)
    assert deleted is True

    fetched = await report_crud.get_scheduled_report(db_session, report.id, company_id)
    assert fetched is None
