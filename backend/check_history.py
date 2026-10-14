import asyncio
from app.database import SessionLocal
from app.models.report import ReportHistory
from sqlalchemy import select

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(ReportHistory).order_by(ReportHistory.generated_at.desc()).limit(10))
        histories = result.scalars().all()
        for h in histories:
            print(f"Report: {h.report_name}, Status: {h.status}, Error: {h.error_message}")

if __name__ == "__main__":
    asyncio.run(main())
