from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserCreate
from uuid import UUID

class CRUDUser:
    async def get_by_id(self, db: AsyncSession, user_id: UUID) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_company(self, db: AsyncSession, company_id: UUID) -> list[User]:
        result = await db.execute(select(User).where(User.company_id == company_id))
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, obj_in: UserCreate) -> User:
        user = User(**obj_in.model_dump())
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def update_last_login(self, db: AsyncSession, user: User) -> User:
        from datetime import datetime
        user.last_login = datetime.utcnow()
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def update_password(self, db: AsyncSession, user: User, hashed_password: str) -> User:
        user.password = hashed_password
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

user = CRUDUser()
