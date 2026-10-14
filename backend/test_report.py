import asyncio
from app.database import SessionLocal
from app.services.report import report_service
from app.models.report import ReportType
from sqlalchemy import select
from app.models.user import User

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No user found")
            return
            
        print(f"Running for company {user.company_id}")
        
        try:
            print("\nGenerating stock movement report...")
            data = await report_service.generate_report_data(
                db=db,
                company_id=user.company_id,
                report_type=ReportType("stock_movement"),
                filters={},
            )
            print("Success! Data columns:", data.columns)
            print("Data rows:", len(data.rows))
            
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
