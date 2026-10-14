import asyncio
from sqlalchemy import select, func, update
from app.database import SessionLocal
from app.models.sale import Sale
from app.models.company import Company
from app.models.invoice_sequence import InvoiceSequence

async def main():
    async with SessionLocal() as db:
        # Get all companies
        companies = await db.execute(select(Company))
        companies = companies.scalars().all()
        
        for comp in companies:
            # Find max invoice number for this company
            result = await db.execute(
                select(func.max(Sale.invoice_number)).where(Sale.company_id == comp.id)
            )
            max_inv = result.scalar_one_or_none()
            
            last_num = 0
            if max_inv:
                # max_inv format is like "INV-2026-000005"
                parts = max_inv.split("-")
                if len(parts) == 3:
                    try:
                        last_num = int(parts[2])
                    except ValueError:
                        pass
            
            # Update or create InvoiceSequence
            seq_result = await db.execute(
                select(InvoiceSequence).where(InvoiceSequence.company_id == comp.id)
            )
            seq = seq_result.scalar_one_or_none()
            
            if not seq:
                seq = InvoiceSequence(company_id=comp.id, last_invoice_number=last_num)
                db.add(seq)
                print(f"Created sequence for company {comp.id} with {last_num}")
            else:
                if seq.last_invoice_number < last_num:
                    seq.last_invoice_number = last_num
                    print(f"Updated sequence for company {comp.id} to {last_num}")
        
        await db.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
