import asyncio
from app.database import SessionLocal
from app.crud.customer import customer as customer_crud
from uuid import UUID

async def run():
    async with SessionLocal() as session:
        cust_id_str = '0f9cb251-291a-46a1-b649-5246daa42e54'
        print(f"Fetching profile for {cust_id_str}...")
        try:
            data = await customer_crud.get_detailed_profile(session, UUID(cust_id_str))
            print("Successfully got data dict. Validating against schema...")
            
            from app.schemas.customer import CustomerDetailedProfileResponse
            resp = CustomerDetailedProfileResponse(**data)
            print("Validation successful!")
        except Exception as e:
            import traceback
            traceback.print_exc()
            
asyncio.run(run())
