from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.category import Category
from app.models.product import Product
from uuid import UUID

class CRUDCategory:
    async def get(self, db: AsyncSession, category_id: UUID) -> Category | None:
        result = await db.execute(select(Category).where(Category.id == category_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, db: AsyncSession, company_id: UUID, name: str) -> Category | None:
        clean_name = name.strip()
        result = await db.execute(
            select(Category)
            .where(Category.company_id == company_id)
            .where(func.lower(Category.name) == func.lower(clean_name))
        )
        return result.scalar_one_or_none()

    async def list(self, db: AsyncSession, company_id: UUID, skip: int = 0, limit: int = 100, search: str | None = None) -> tuple[list[Category], int]:
        query = select(Category).where(Category.company_id == company_id)
        if search:
            query = query.where(Category.name.ilike(f"%{search}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Category.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def create(self, db: AsyncSession, company_id: UUID, name: str, description: str | None, status: str) -> Category:
        category = Category(company_id=company_id, name=name, description=description, status=status)
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return category

    async def update(self, db: AsyncSession, category: Category, name: str | None = None, description: str | None = None, status: str | None = None) -> Category:
        if name is not None:
            category.name = name
        if description is not None:
            category.description = description
        if status is not None:
            category.status = status
        await db.commit()
        await db.refresh(category)
        return category

    async def delete(self, db: AsyncSession, category: Category) -> None:
        await db.delete(category)
        await db.commit()

    async def count_products(self, db: AsyncSession, category_id: UUID) -> int:
        result = await db.execute(select(func.count(Product.id)).where(Product.category_id == category_id))
        return result.scalar() or 0

category = CRUDCategory()
