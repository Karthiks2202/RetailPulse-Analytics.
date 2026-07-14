from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.refresh_token import RefreshToken
from datetime import datetime
from uuid import UUID

class CRUDRefreshToken:
    async def get_by_token(self, db: AsyncSession, token: str) -> RefreshToken | None:
        result = await db.execute(select(RefreshToken).where(RefreshToken.token == token))
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, user_id: UUID, token: str, expires_at: datetime) -> RefreshToken:
        rt = RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
        db.add(rt)
        await db.commit()
        await db.refresh(rt)
        return rt

    async def delete(self, db: AsyncSession, token: str) -> None:
        result = await db.execute(delete(RefreshToken).where(RefreshToken.token == token))
        await db.commit()
        return result.rowcount

refresh_token = CRUDRefreshToken()
