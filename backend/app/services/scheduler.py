from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import SessionLocal
from app.crud import report as report_crud
from app.services.forecast import forecast_service
from app.services.notification import notification_service
from app.services.report import report_service
from app.services.email import email_service
from app.models.company import Company
from app.models.report import ScheduledReport, ReportFrequency, ReportExecutionStatus
from datetime import datetime, time as dt_time

scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("cron", hour=0, minute=0)
async def refresh_expired_forecast_accuracy():
    async with SessionLocal() as db:
        result = await db.execute(select(Company.id))
        company_ids = [row[0] for row in result.all()]
        for company_id in company_ids:
            try:
                await forecast_service.refresh_accuracy_for_expired_forecasts(db, company_id)
            except Exception:
                continue


@scheduler.scheduled_job("cron", hour="*/6", minute=0)
async def evaluate_inventory_alerts():
    async with SessionLocal() as db:
        result = await db.execute(select(Company.id))
        company_ids = [row[0] for row in result.all()]
        for company_id in company_ids:
            try:
                await notification_service.run_bulk_evaluation(db, company_id)
            except Exception:
                continue


@scheduler.scheduled_job("cron", hour=1, minute=0)
async def cleanup_expired_notifications():
    async with SessionLocal() as db:
        result = await db.execute(select(Company.id))
        company_ids = [row[0] for row in result.all()]
        for company_id in company_ids:
            try:
                await notification_service.run_bulk_evaluation(db, company_id)
            except Exception:
                continue
        try:
            from app.crud.notification import notification as notification_crud
            await notification_crud.delete_expired(db)
        except Exception:
            pass


def _should_execute(report: ScheduledReport, now: datetime) -> bool:
    if not report.is_active:
        return False
    current_time = now.time()
    if current_time < report.execution_time:
        return False
    if report.last_run_at is None:
        return True
    last_run = report.last_run_at
    if report.frequency == ReportFrequency.DAILY:
        return last_run.date() != now.date()
    elif report.frequency == ReportFrequency.WEEKLY:
        week_diff = (now - last_run).days >= 7
        return week_diff
    elif report.frequency == ReportFrequency.MONTHLY:
        return now.month != last_run.month or now.year != last_run.year
    return False


@scheduler.scheduled_job("cron", minute="*/15")
async def execute_scheduled_reports():
    async with SessionLocal() as db:
        try:
            result = await db.execute(select(ScheduledReport).where(ScheduledReport.is_active == True))
            reports = result.scalars().all()
            now = datetime.utcnow()
            for report in reports:
                if not _should_execute(report, now):
                    continue
                try:
                    history_entry = await report_crud.create_report_history(
                        db=db,
                        company_id=report.company_id,
                        report_name=report.name,
                        report_type=report.report_type.value,
                        filters=report.filters or {},
                        export_format=report.export_format.value,
                        generated_by=report.created_by,
                        scheduled_report_id=report.id,
                        status=ReportExecutionStatus.PROCESSING,
                    )
                    report_data = await report_service.generate_report_data(
                        db=db,
                        company_id=report.company_id,
                        report_type=report.report_type,
                        filters=report.filters or {},
                    )
                    file_content = None
                    filename = f"{report.name.replace(' ', '_').lower()}"
                    if report.export_format.value == "csv":
                        file_content = report_service.generate_csv(report_data, report.name)
                        file_data = {"content": file_content, "filename": f"{filename}.csv", "content_type": "text/csv"}
                    else:
                        file_content = report_service.generate_pdf(report_data, report.name)
                        file_data = {"content": file_content.hex(), "filename": f"{filename}.pdf", "content_type": "application/pdf"}

                    await report_crud.update_report_history(db=db, history_id=history_entry.id, status=ReportExecutionStatus.COMPLETED, file_data=file_data)

                    await email_service.send_scheduled_report(
                        db=db,
                        company_id=report.company_id,
                        recipients=report.recipients,
                        subject=f"Scheduled Report: {report.name}",
                        body=f"Please find the attached {report.export_format.value.upper()} report '{report.name}' generated on {now.isoformat()}.",
                        attachment=file_data,
                    )

                    report.last_run_at = now
                    report.last_run_status = "completed"
                    report.updated_at = now
                    await db.commit()
                except Exception as e:
                    if 'history_entry' in locals():
                        await report_crud.update_report_history(db=db, history_id=history_entry.id, status=ReportExecutionStatus.FAILED, error_message=str(e))
                    else:
                        await report_crud.create_report_history(
                            db=db,
                            company_id=report.company_id,
                            report_name=report.name,
                            report_type=report.report_type.value,
                            filters=report.filters or {},
                            export_format=report.export_format.value,
                            generated_by=report.created_by,
                            scheduled_report_id=report.id,
                            status=ReportExecutionStatus.FAILED,
                            error_message=str(e),
                        )
                    report.last_run_at = now
                    report.last_run_status = "failed"
                    await db.commit()
        except Exception:
            pass

