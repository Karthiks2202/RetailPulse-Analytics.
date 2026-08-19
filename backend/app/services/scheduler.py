from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import SessionLocal
from app.services.forecast import forecast_service
from app.models.company import Company

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
