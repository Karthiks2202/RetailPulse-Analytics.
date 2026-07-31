import asyncio
from app.database import SessionLocal
from app.models.customer import Customer
from app.models.sale import Sale
from sqlalchemy import select, update

async def run():
    async with SessionLocal() as session:
        # Get all customers
        res = await session.execute(select(Customer))
        custs = res.scalars().all()
        cust_map = {}
        for c in custs:
            # Map first name to customer ID (assuming customer_name in sales matches first_name for now based on earlier logs)
            cust_map[c.first_name.lower()] = c.id
            # Also map full name just in case
            full_name = f"{c.first_name} {c.last_name}".lower().strip()
            cust_map[full_name] = c.id
            
        print(f"Found {len(custs)} customers.")

        # Get all sales with missing customer_id
        res_sales = await session.execute(select(Sale).where(Sale.customer_id.is_(None)))
        sales = res_sales.scalars().all()
        print(f"Found {len(sales)} sales with missing customer_id.")
        
        updated = 0
        for s in sales:
            if s.customer_name:
                name_lower = s.customer_name.lower().strip()
                if name_lower in cust_map:
                    s.customer_id = cust_map[name_lower]
                    updated += 1
                else:
                    # try partial match
                    for c_name, c_id in cust_map.items():
                        if c_name in name_lower or name_lower in c_name:
                            s.customer_id = c_id
                            updated += 1
                            break

        if updated > 0:
            await session.commit()
            print(f"Updated {updated} sales with customer IDs.")
        else:
            print("No sales needed updating or couldn't match any names.")

asyncio.run(run())
