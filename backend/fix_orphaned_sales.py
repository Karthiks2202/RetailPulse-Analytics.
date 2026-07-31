"""
Creates minimal Customer records for orphaned sales and links them.
Orphaned sales: Ravi, suresh, Suriya, Sundar
"""
import asyncio
from app.database import SessionLocal
from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.company import Company
from app.models.sale import Sale
from sqlalchemy import select
import uuid

ORPHANED_NAMES = [
    ("Ravi", ""),
    ("Suresh", ""),
    ("Suriya", ""),
    ("Sundar", ""),
]

async def run():
    async with SessionLocal() as session:
        # Get first company
        res = await session.execute(select(Company))
        company = res.scalars().first()
        if not company:
            print("No company found!")
            return
        print(f"Company: {company.name} ({company.id})")

        # Get all existing customer names
        existing_res = await session.execute(select(Customer).where(Customer.company_id == company.id))
        existing = existing_res.scalars().all()
        existing_names = {f"{c.first_name} {c.last_name}".lower().strip(): c for c in existing}
        existing_first = {c.first_name.lower(): c for c in existing}
        print(f"Existing customers: {list(existing_names.keys())}")

        # Get orphaned sales names
        sales_res = await session.execute(
            select(Sale).where(Sale.customer_id.is_(None))
        )
        orphaned_sales = sales_res.scalars().all()
        print(f"\nOrphaned sales ({len(orphaned_sales)}):")
        for s in orphaned_sales:
            print(f"  {s.invoice_number}: '{s.customer_name}' = Rs.{s.total_amount}")

        # For each orphaned sale, create customer if not exists and link
        linked = 0
        created = 0
        for sale in orphaned_sales:
            if not sale.customer_name:
                continue
            name_lower = sale.customer_name.lower().strip()
            name_parts = sale.customer_name.strip().split()
            first_name = name_parts[0]
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

            # Check if customer already exists (full name or first name only)
            full_key = f"{first_name} {last_name}".lower().strip()
            customer = existing_names.get(full_key) or existing_names.get(name_lower) or existing_first.get(first_name.lower())

            if not customer:
                # Create the customer
                print(f"\nCreating customer: '{first_name} {last_name}'")
                customer = Customer(
                    id=uuid.uuid4(),
                    company_id=company.id,
                    first_name=first_name,
                    last_name=last_name if last_name else ".",
                    customer_type=CustomerType.RETAIL,
                    status=CustomerStatus.ACTIVE,
                )
                session.add(customer)
                await session.flush()
                existing_names[full_key] = customer
                existing_first[first_name.lower()] = customer
                created += 1
                print(f"  Created ID: {customer.id}")

            # Link the sale
            sale.customer_id = customer.id
            linked += 1
            print(f"  Linked sale {sale.invoice_number} -> customer {customer.first_name} {customer.last_name}")

        await session.commit()
        print(f"\nDone! Created {created} customers, linked {linked} sales.")

asyncio.run(run())
