import asyncio
from app.database import SessionLocal
from app.crud.customer import customer as customer_crud
from uuid import UUID

async def run():
    async with SessionLocal() as session:
        cust_id_str = '0f9cb251-291a-46a1-b649-5246daa42e54'
        print(f"Fetching purchase detail for {cust_id_str}...")
        try:
            data = await customer_crud.get_purchase_detail(session, UUID(cust_id_str), recent_limit=10, top_products_limit=5)
            print("Successfully got data dict. Validating...")
            from app.schemas.customer import CustomerPurchaseDetailResponse
            resp = CustomerPurchaseDetailResponse(**data)
            print("Validation successful!")
            print(f"Total Orders: {resp.total_orders}, Recent TXNs: {len(resp.recent_transactions)}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            
asyncio.run(run())
