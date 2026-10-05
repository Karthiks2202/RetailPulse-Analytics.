import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy import select, update
from app.database import engine
from app.models.user import User
from app.utils.security import hash_password

async def main():
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == "karthik@example.com"))
        user = result.scalar_one_or_none()
        if user:
            print("Found user:", user.email)
            hashed = hash_password("Karthik@??")
            user.password = hashed
            await session.commit()
            print("Password updated successfully.")
        else:
            print("User not found.")

if __name__ == "__main__":
    asyncio.run(main())
