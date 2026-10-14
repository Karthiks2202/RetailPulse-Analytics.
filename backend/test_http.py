import asyncio
import httpx
from app.database import SessionLocal
from app.models.user import User
from sqlalchemy import select
from app.utils.security import create_access_token # Assuming this is the right path
from datetime import timedelta
from app.config import settings

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No user found")
            return
            
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        token = create_access_token(
            subject=str(user.id), expires_delta=access_token_expires
        )
        
    print(f"Got token for user {user.id}")
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        
        print("\n--- Testing Stock Movement Report ---")
        response = await client.get("http://localhost:8000/api/reports/data?report_type=stock_movement&page=1&page_size=20", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text[:200]}")

if __name__ == "__main__":
    try:
        from app.utils.security import create_access_token
    except ImportError:
        try:
            from app.core.security import create_access_token
        except ImportError:
            from app.security import create_access_token
            
    asyncio.run(main())
