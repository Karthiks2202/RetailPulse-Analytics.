from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.models.inventory import StockMovement, InventoryAdjustment, MovementType, AdjustmentType
from app.models.product import Product
from app.models.category import Category
from app.models.user import User
from uuid import UUID
from datetime import datetime
from typing import Optional


def get_stock_status(available_stock: int, reorder_level: int) -> str:
    if available_stock == 0:
        return "OUT_OF_STOCK"
    elif available_stock <= reorder_level:
        return "LOW_STOCK"
    return "IN_STOCK"


class CRUDInventory:
    async def get_inventory_items(
        self,
        db: AsyncSession,
        company_id: UUID,
        search: str | None = None,
        category_id: UUID | None = None,
        stock_status: str | None = None,
        brand: str | None = None,
        skip: int = 0,
        limit: int = 100,
        sort_by: str = "name",
        sort_dir: str = "asc",
    ) -> tuple[list[dict], int]:
        query = select(Product).where(Product.company_id == company_id)

        if search:
            query = query.where(
                Product.name.ilike(f"%{search}%")
                | Product.sku.ilike(f"%{search}%")
            )

        if category_id:
            query = query.where(Product.category_id == category_id)

        if brand:
            query = query.where(Product.brand.ilike(f"%{brand}%"))

        available_expr = Product.stock_quantity - Product.reserved_stock

        if stock_status:
            if stock_status == "OUT_OF_STOCK":
                query = query.where(available_expr == 0)
            elif stock_status == "LOW_STOCK":
                query = query.where(
                    and_(available_expr > 0, available_expr <= Product.low_stock_threshold)
                )
            elif stock_status == "IN_STOCK":
                query = query.where(available_expr > Product.low_stock_threshold)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        sort_map = {
            "name": Product.name,
            "current_stock": Product.stock_quantity,
            "recently_updated": Product.updated_at,
        }
        sort_column = sort_map.get(sort_by, Product.name)
        if sort_dir == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        products = list(result.scalars().all())

        items = []
        for p in products:
            available = p.stock_quantity - p.reserved_stock
            status = get_stock_status(available, p.low_stock_threshold)
            cat_name = None
            if p.category_id:
                cat = await db.get(Category, p.category_id)
                if cat:
                    cat_name = cat.name

            items.append({
                "id": p.id,
                "company_id": p.company_id,
                "name": p.name,
                "sku": p.sku,
                "category_id": p.category_id,
                "brand": p.brand,
                "description": p.description,
                "unit_price": float(p.unit_price),
                "cost_price": float(p.cost_price),
                "stock_quantity": p.stock_quantity,
                "reserved_stock": p.reserved_stock,
                "available_stock": available,
                "low_stock_threshold": p.low_stock_threshold,
                "stock_status": status,
                "unit_of_measure": p.unit_of_measure.value,
                "category_name": cat_name,
            })

        return items, total

    async def get_inventory_summary(self, db: AsyncSession, company_id: UUID) -> dict:
        products_query = select(Product).where(Product.company_id == company_id)
        result = await db.execute(products_query)
        products = list(result.scalars().all())

        total_products = len(products)
        total_inventory_quantity = sum(p.stock_quantity for p in products)
        low_stock = 0
        out_of_stock = 0
        in_stock = 0

        for p in products:
            available = p.stock_quantity - p.reserved_stock
            status = get_stock_status(available, p.low_stock_threshold)
            if status == "OUT_OF_STOCK":
                out_of_stock += 1
            elif status == "LOW_STOCK":
                low_stock += 1
            else:
                in_stock += 1

        return {
            "total_products": total_products,
            "total_inventory_quantity": total_inventory_quantity,
            "low_stock_products": low_stock,
            "out_of_stock_products": out_of_stock,
            "in_stock_products": in_stock,
        }

    async def get_category_breakdown(self, db: AsyncSession, company_id: UUID) -> list[dict]:
        products_query = select(Product).where(Product.company_id == company_id)
        result = await db.execute(products_query)
        products = list(result.scalars().all())

        category_map: dict[str, int] = {}
        for p in products:
            if p.category_id:
                cat = await db.get(Category, p.category_id)
                if cat:
                    category_map[cat.name] = category_map.get(cat.name, 0) + 1
                else:
                    category_map["Uncategorized"] = category_map.get("Uncategorized", 0) + 1
            else:
                category_map["Uncategorized"] = category_map.get("Uncategorized", 0) + 1

        return [{"category_name": k, "product_count": v} for k, v in category_map.items()]

    async def get_stock_status_breakdown(self, db: AsyncSession, company_id: UUID) -> list[dict]:
        products_query = select(Product).where(Product.company_id == company_id)
        result = await db.execute(products_query)
        products = list(result.scalars().all())

        status_map: dict[str, int] = {"IN_STOCK": 0, "LOW_STOCK": 0, "OUT_OF_STOCK": 0}
        for p in products:
            available = p.stock_quantity - p.reserved_stock
            status = get_stock_status(available, p.low_stock_threshold)
            status_map[status] = status_map.get(status, 0) + 1

        return [{"stock_status": k, "product_count": v} for k, v in status_map.items()]

    async def add_stock(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID,
        quantity: int,
        user_id: UUID,
        reason: str | None = None,
        remarks: str | None = None,
    ) -> Product:
        product = await db.get(Product, product_id)
        if not product or product.company_id != company_id:
            raise ValueError("Product not found")

        previous_quantity = product.stock_quantity
        product.stock_quantity += quantity

        movement = StockMovement(
            company_id=company_id,
            product_id=product_id,
            movement_type=MovementType.STOCK_ADDITION,
            previous_quantity=previous_quantity,
            updated_quantity=product.stock_quantity,
            quantity_changed=quantity,
            reason=reason,
            user_id=user_id,
        )
        db.add(movement)

        adjustment = InventoryAdjustment(
            company_id=company_id,
            product_id=product_id,
            adjustment_type=AdjustmentType.STOCK_IN,
            quantity=quantity,
            reason=reason,
            remarks=remarks,
            adjusted_by=user_id,
        )
        db.add(adjustment)

        await db.commit()
        await db.refresh(product)
        return product

    async def remove_stock(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID,
        quantity: int,
        user_id: UUID,
        reason: str | None = None,
        remarks: str | None = None,
    ) -> Product:
        product = await db.get(Product, product_id)
        if not product or product.company_id != company_id:
            raise ValueError("Product not found")

        available = product.stock_quantity - product.reserved_stock
        if quantity > available:
            raise ValueError(f"Insufficient available stock. Available: {available}, Requested: {quantity}")

        previous_quantity = product.stock_quantity
        product.stock_quantity -= quantity

        movement = StockMovement(
            company_id=company_id,
            product_id=product_id,
            movement_type=MovementType.STOCK_REMOVAL,
            previous_quantity=previous_quantity,
            updated_quantity=product.stock_quantity,
            quantity_changed=-quantity,
            reason=reason,
            user_id=user_id,
        )
        db.add(movement)

        adjustment = InventoryAdjustment(
            company_id=company_id,
            product_id=product_id,
            adjustment_type=AdjustmentType.STOCK_OUT,
            quantity=quantity,
            reason=reason,
            remarks=remarks,
            adjusted_by=user_id,
        )
        db.add(adjustment)

        await db.commit()
        await db.refresh(product)
        return product

    async def adjust_stock(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID,
        quantity_change: int,
        user_id: UUID,
        reason: str | None = None,
        remarks: str | None = None,
    ) -> Product:
        product = await db.get(Product, product_id)
        if not product or product.company_id != company_id:
            raise ValueError("Product not found")

        previous_quantity = product.stock_quantity
        new_quantity = previous_quantity + quantity_change

        if new_quantity < 0:
            raise ValueError("Stock quantity cannot go below 0")

        product.stock_quantity = new_quantity

        movement_type = MovementType.MANUAL_ADJUSTMENT
        if quantity_change > 0:
            adj_type = AdjustmentType.STOCK_IN
        elif quantity_change < 0:
            adj_type = AdjustmentType.STOCK_OUT
        else:
            adj_type = AdjustmentType.MANUAL_ADJUSTMENT

        movement = StockMovement(
            company_id=company_id,
            product_id=product_id,
            movement_type=movement_type,
            previous_quantity=previous_quantity,
            updated_quantity=new_quantity,
            quantity_changed=quantity_change,
            reason=reason,
            user_id=user_id,
        )
        db.add(movement)

        adjustment = InventoryAdjustment(
            company_id=company_id,
            product_id=product_id,
            adjustment_type=adj_type,
            quantity=quantity_change,
            reason=reason,
            remarks=remarks,
            adjusted_by=user_id,
        )
        db.add(adjustment)

        await db.commit()
        await db.refresh(product)
        return product

    async def get_stock_movements(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID | None = None,
        movement_type: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[StockMovement], int]:
        query = select(StockMovement).options(selectinload(StockMovement.product)).where(StockMovement.company_id == company_id)

        if product_id:
            query = query.where(StockMovement.product_id == product_id)

        if movement_type:
            try:
                mt = MovementType(movement_type)
                query = query.where(StockMovement.movement_type == mt)
            except ValueError:
                pass

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        movements = list(result.scalars().all())
        return movements, total

    async def get_adjustments(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[InventoryAdjustment], int]:
        query = select(InventoryAdjustment).options(selectinload(InventoryAdjustment.product)).where(InventoryAdjustment.company_id == company_id)

        if product_id:
            query = query.where(InventoryAdjustment.product_id == product_id)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(InventoryAdjustment.adjusted_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        adjustments = list(result.scalars().all())
        return adjustments, total

    async def record_sale_movement(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID,
        previous_quantity: int,
        updated_quantity: int,
        quantity_changed: int,
        user_id: UUID | None = None,
        reason: str | None = None,
    ) -> StockMovement:
        movement = StockMovement(
            company_id=company_id,
            product_id=product_id,
            movement_type=MovementType.SALE,
            previous_quantity=previous_quantity,
            updated_quantity=updated_quantity,
            quantity_changed=quantity_changed,
            reason=reason,
            user_id=user_id,
        )
        db.add(movement)
        await db.commit()
        await db.refresh(movement)
        return movement

    async def update_reorder_level(
        self,
        db: AsyncSession,
        company_id: UUID,
        product_id: UUID,
        low_stock_threshold: int,
    ) -> Product:
        product = await db.get(Product, product_id)
        if not product or product.company_id != company_id:
            raise ValueError("Product not found")

        if low_stock_threshold < 0:
            raise ValueError("Reorder level cannot be negative")

        product.low_stock_threshold = low_stock_threshold
        await db.commit()
        await db.refresh(product)
        return product


inventory = CRUDInventory()
