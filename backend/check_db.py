import asyncio
from app.database import SessionLocal
from app.models.customer import Customer
from app.models.sale import Sale
from sqlalchemy import select

async def run():
    async with SessionLocal() as session:
        # Get customers
        res = await session.execute(select(Customer))
        custs = res.scalars().all()
        for c in custs:
            print(f"Customer: {c.first_name}, Total Spent: {c.total_spent}, Total Purchases: {c.total_purchases}")
            
        print("---")
        # Get sales
        res_sales = await session.execute(select(Sale))
        sales = res_sales.scalars().all()
        for s in sales:
            print(f"Sale {s.invoice_number}, Amount: {s.total_amount}, Customer Name: {s.customer_name}, Customer ID: {s.customer_id}")

asyncio.run(run())
