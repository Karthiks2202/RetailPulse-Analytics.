import asyncio
from app.database import SessionLocal
from app.crud.customer import customer as customer_crud

async def run():
    async with SessionLocal() as session:
        # Get first company ID
        from app.models.company import Company
        from sqlalchemy import select
        res = await session.execute(select(Company))
        comp = res.scalars().first()
        if not comp:
            print("No companies found.")
            return

        customers, total = await customer_crud.list(session, comp.id)
        for c in customers:
            summary = await customer_crud.get_purchase_summary(session, c.id)
            print(f"Customer: {c.first_name} {c.last_name}")
            print(f"  Total Purchases: {summary['total_purchases']}")
            print(f"  Total Spent: {summary['total_spent']}")
            
asyncio.run(run())
