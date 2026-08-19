import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy import select
from app.database import engine
from app.models.user import User

async def main():
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        for user in users:
            print(f"User: {user.email}, Status: {user.status.value}")
        if not users:
            print("No users in DB")

if __name__ == "__main__":
    asyncio.run(main())
