from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.product import Product, ProductStatus
from app.models.category import Category
from uuid import UUID

class CRUDProduct:
    async def get(self, db: AsyncSession, product_id: UUID) -> Product | None:
        result = await db.execute(select(Product).where(Product.id == product_id))
        return result.scalar_one_or_none()

    async def get_by_sku(self, db: AsyncSession, company_id: UUID, sku: str) -> Product | None:
        result = await db.execute(
            select(Product).where(Product.company_id == company_id).where(Product.sku == sku)
        )
        return result.scalar_one_or_none()

    async def get_by_name_in_category(self, db: AsyncSession, company_id: UUID, name: str, category_id: UUID | None = None) -> Product | None:
        query = select(Product).where(Product.company_id == company_id).where(Product.name == name)
        if category_id is not None:
            query = query.where(Product.category_id == category_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
        category_id: UUID | None = None,
        status: ProductStatus | None = None,
        brand: str | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[Product], int]:
        query = select(Product).where(Product.company_id == company_id)

        if search:
            query = query.where(
                Product.name.ilike(f"%{search}%") |
                Product.sku.ilike(f"%{search}%") |
                Product.brand.ilike(f"%{search}%")
            )

        if category_id:
            query = query.where(Product.category_id == category_id)

        if status:
            query = query.where(Product.status == status)

        if brand:
            query = query.where(Product.brand.ilike(f"%{brand}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        sort_column = getattr(Product, sort_by, Product.created_at)
        if sort_dir == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def create(self, db: AsyncSession, company_id: UUID, name: str, sku: str, category_id: UUID | None, brand: str | None, description: str | None, unit_price: float, cost_price: float, stock_quantity: int, low_stock_threshold: int, unit_of_measure: str, status: str) -> Product:
        product = Product(
            company_id=company_id,
            name=name,
            sku=sku,
            category_id=category_id,
            brand=brand,
            description=description,
            unit_price=unit_price,
            cost_price=cost_price,
            stock_quantity=stock_quantity,
            low_stock_threshold=low_stock_threshold,
            unit_of_measure=unit_of_measure,
            status=status,
        )
        db.add(product)
        await db.commit()
        await db.refresh(product)
        return product

    async def update(self, db: AsyncSession, product: Product, **kwargs) -> Product:
        for key, value in kwargs.items():
            if value is not None and hasattr(product, key):
                setattr(product, key, value)
        await db.commit()
        await db.refresh(product)
        return product

    async def delete(self, db: AsyncSession, product: Product) -> None:
        await db.delete(product)
        await db.commit()

product = CRUDProduct()
