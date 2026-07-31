import asyncio
from app.database import SessionLocal
from app.models.sale import Sale
from sqlalchemy import select

async def run():
    async with SessionLocal() as session:
        # Show all unlinked sales
        res = await session.execute(
            select(Sale.customer_name, Sale.total_amount, Sale.invoice_number, Sale.customer_id)
            .where(Sale.customer_id.is_(None))
        )
        rows = res.all()
        print(f"Sales without customer_id ({len(rows)} total):")
        for r in rows:
            print(f"  Invoice: {r.invoice_number}, Name: '{r.customer_name}', Amount: {r.total_amount}")

asyncio.run(run())
