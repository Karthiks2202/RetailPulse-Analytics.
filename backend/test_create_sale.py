import asyncio
import httpx
from app.database import SessionLocal
from app.models.user import User
from sqlalchemy import select
from app.utils.security import create_access_token

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.role == 'COMPANY_ADMIN').limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No admin user found")
            return
            
        token = create_access_token(str(user.id), user.email, user.role.value, str(user.company_id))
        
    print(f"Got token for admin {user.id}")
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "customer_name": "Carol White",
            "sale_date": "2026-10-08T06:33:00Z",
            "sales_channel": "Online Store",
            "payment_method": "UPI",
            "items": [
                {
                    "product_id": "00000000-0000-0000-0000-000000000000", # We need a real product id
                    "quantity": 1,
                    "unit_price": 10.0,
                    "discount": 0.0,
                    "tax": 0.0
                }
            ]
        }
        
        # first let's get a real product
        async with SessionLocal() as db:
            from app.models.product import Product
            prod_result = await db.execute(select(Product).where(Product.company_id == user.company_id).limit(1))
            product = prod_result.scalar_one_or_none()
            if not product:
                print("No product found")
                return
            payload["items"][0]["product_id"] = str(product.id)
            payload["items"][0]["unit_price"] = float(product.unit_price)

        response = await client.post("http://localhost:8000/api/sales", json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")

if __name__ == "__main__":
    asyncio.run(main())
