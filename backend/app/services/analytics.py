from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from typing import Optional, List
from app.models.sale import Sale, SaleItem, SaleStatus, SalesChannel, PaymentMethod
from app.models.product import Product, ProductStatus
from app.models.category import Category
from app.models.inventory import StockMovement, MovementType
from app.models.audit_log import AuditLog
from app.crud.audit_log import audit_log as audit_log_crud
from app.crud.inventory import inventory as inventory_crud
from app.services.audit import audit_service


class AnalyticsService:
    def _get_stock_status(self, available: int, threshold: int) -> str:
        if available == 0:
            return "OUT_OF_STOCK"
        elif available <= threshold:
            return "LOW_STOCK"
        return "IN_STOCK"

    def _apply_sale_filters(self, query, company_id: UUID, filters: Optional[dict]):
        query = query.where(Sale.company_id == company_id)
        if not filters:
            return query

        date_from = filters.get("date_from")
        date_to = filters.get("date_to")
        product_id = filters.get("product_id")
        category_id = filters.get("category_id")
        brand = filters.get("brand")
        sales_channel = filters.get("sales_channel")
        payment_method = filters.get("payment_method")

        if date_from:
            query = query.where(Sale.sale_date >= date_from)
        if date_to:
            query = query.where(Sale.sale_date <= date_to)
        if sales_channel:
            query = query.where(Sale.sales_channel == sales_channel)
        if payment_method:
            query = query.where(Sale.payment_method == payment_method)

        if product_id or category_id or brand:
            query = query.join(SaleItem, Sale.id == SaleItem.sale_id)
            if product_id:
                query = query.where(SaleItem.product_id == product_id)
            if category_id:
                query = query.where(SaleItem.category_id == category_id)
            if brand:
                query = query.join(Product, SaleItem.product_id == Product.id).where(Product.brand.ilike(f"%{brand}%"))

        return query.distinct()

    async def get_kpi_dashboard(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> dict:
        base_query = select(Sale).where(Sale.company_id == company_id)
        base_query = self._apply_sale_filters(base_query, company_id, filters)

        total_revenue_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total_amount), 0)).select_from(base_query.subquery())
        )
        total_revenue = float(total_revenue_result.scalar() or 0)

        total_orders_result = await db.execute(
            select(func.count(Sale.id)).select_from(base_query.subquery())
        )
        total_orders = total_orders_result.scalar() or 0

        total_products_sold_result = await db.execute(
            select(func.coalesce(func.sum(SaleItem.quantity), 0))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .select_from(base_query.subquery())
        )
        total_products_sold = total_products_sold_result.scalar() or 0

        average_order_value = total_revenue / total_orders if total_orders > 0 else 0.0

        products_query = select(Product).where(Product.company_id == company_id)
        if filters:
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if category_id:
                products_query = products_query.where(Product.category_id == category_id)
            if brand:
                products_query = products_query.where(Product.brand.ilike(f"%{brand}%"))

        products_result = await db.execute(products_query)
        products = list(products_result.scalars().all())

        total_inventory_value = sum(float(p.cost_price * p.stock_quantity) for p in products)
        low_stock_products = 0
        out_of_stock_products = 0
        total_categories_set = set()

        for p in products:
            available = p.stock_quantity - p.reserved_stock
            status = self._get_stock_status(available, p.low_stock_threshold)
            if status == "LOW_STOCK":
                low_stock_products += 1
            elif status == "OUT_OF_STOCK":
                out_of_stock_products += 1
            if p.category_id:
                total_categories_set.add(p.category_id)

        total_categories_result = await db.execute(
            select(func.count(Category.id)).where(Category.company_id == company_id)
        )
        total_categories = total_categories_result.scalar() or 0

        return {
            "total_revenue": total_revenue,
            "total_orders": total_orders,
            "total_products_sold": int(total_products_sold),
            "average_order_value": average_order_value,
            "total_inventory_value": total_inventory_value,
            "low_stock_products": low_stock_products,
            "out_of_stock_products": out_of_stock_products,
            "total_categories": total_categories,
        }

    async def get_revenue_trend(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, interval: str = "daily") -> List[dict]:
        query = select(Sale).where(Sale.company_id == company_id)
        query = self._apply_sale_filters(query, company_id, filters)
        result = await db.execute(query)
        sales = list(result.scalars().all())

        if not sales:
            return []

        if interval == "weekly":
            buckets = {}
            for s in sales:
                key = s.sale_date.strftime("%Y-W%W")
                buckets[key] = buckets.get(key, 0) + float(s.total_amount)
            return [{"period": k, "revenue": v, "orders": 0} for k, v in sorted(buckets.items())]
        elif interval == "monthly":
            buckets = {}
            for s in sales:
                key = s.sale_date.strftime("%Y-%m")
                buckets[key] = buckets.get(key, 0) + float(s.total_amount)
            return [{"period": k, "revenue": v, "orders": 0} for k, v in sorted(buckets.items())]
        else:
            buckets = {}
            for s in sales:
                key = s.sale_date.strftime("%Y-%m-%d")
                buckets[key] = buckets.get(key, 0) + float(s.total_amount)
            return [{"period": k, "revenue": v, "orders": 0} for k, v in sorted(buckets.items())]

    async def get_sales_trend(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, interval: str = "daily") -> List[dict]:
        query = select(Sale, SaleItem).join(SaleItem, Sale.id == SaleItem.sale_id).where(Sale.company_id == company_id)
        query = self._apply_sale_filters(query, company_id, filters)
        result = await db.execute(query)
        rows = list(result.all())

        if not rows:
            return []

        if interval == "weekly":
            buckets = {}
            for sale, item in rows:
                key = sale.sale_date.strftime("%Y-W%W")
                entry = buckets.setdefault(key, {"sales": 0.0, "quantity": 0})
                entry["sales"] += float(sale.total_amount)
                entry["quantity"] += item.quantity
            return [{"period": k, **v} for k, v in sorted(buckets.items())]
        elif interval == "monthly":
            buckets = {}
            for sale, item in rows:
                key = sale.sale_date.strftime("%Y-%m")
                entry = buckets.setdefault(key, {"sales": 0.0, "quantity": 0})
                entry["sales"] += float(sale.total_amount)
                entry["quantity"] += item.quantity
            return [{"period": k, **v} for k, v in sorted(buckets.items())]
        else:
            buckets = {}
            for sale, item in rows:
                key = sale.sale_date.strftime("%Y-%m-%d")
                entry = buckets.setdefault(key, {"sales": 0.0, "quantity": 0})
                entry["sales"] += float(sale.total_amount)
                entry["quantity"] += item.quantity
            return [{"period": k, **v} for k, v in sorted(buckets.items())]

    async def get_top_products(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, limit: int = 10) -> List[dict]:
        query = (
            select(
                Product.id,
                Product.name,
                Product.sku,
                Product.unit_price,
                Category.name.label("category_name"),
                Product.brand,
                func.sum(SaleItem.quantity).label("total_quantity"),
                func.sum(SaleItem.total).label("total_revenue"),
            )
            .join(SaleItem, Product.id == SaleItem.product_id)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .group_by(Product.id, Category.name)
            .order_by(func.sum(SaleItem.quantity).desc())
            .limit(limit)
        )
        if filters:
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            sales_channel = filters.get("sales_channel")
            payment_method = filters.get("payment_method")
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if date_from:
                query = query.where(Sale.sale_date >= date_from)
            if date_to:
                query = query.where(Sale.sale_date <= date_to)
            if sales_channel:
                query = query.where(Sale.sales_channel == sales_channel)
            if payment_method:
                query = query.where(Sale.payment_method == payment_method)
            if category_id:
                query = query.where(SaleItem.category_id == category_id)
            if brand:
                query = query.where(Product.brand.ilike(f"%{brand}%"))
        result = await db.execute(query)
        rows = result.all()
        return [
            {
                "product_id": r.id,
                "product_name": r.name,
                "sku": r.sku,
                "category_name": r.category_name,
                "brand": r.brand,
                "total_quantity": int(r.total_quantity or 0),
                "total_revenue": float(r.total_revenue or 0),
            }
            for r in rows
        ]

    async def get_top_categories(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, limit: int = 10) -> List[dict]:
        query = (
            select(
                Category.id,
                Category.name,
                func.sum(SaleItem.quantity).label("total_quantity"),
                func.sum(SaleItem.total).label("total_revenue"),
                func.count(func.distinct(Product.id)).label("product_count"),
            )
            .join(SaleItem, Category.id == SaleItem.category_id)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .group_by(Category.id, Category.name)
            .order_by(func.sum(SaleItem.quantity).desc())
            .limit(limit)
        )
        if filters:
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            sales_channel = filters.get("sales_channel")
            payment_method = filters.get("payment_method")
            brand = filters.get("brand")
            if date_from:
                query = query.where(Sale.sale_date >= date_from)
            if date_to:
                query = query.where(Sale.sale_date <= date_to)
            if sales_channel:
                query = query.where(Sale.sales_channel == sales_channel)
            if payment_method:
                query = query.where(Sale.payment_method == payment_method)
            if brand:
                query = query.where(Product.brand.ilike(f"%{brand}%"))
        result = await db.execute(query)
        rows = result.all()
        return [
            {
                "category_id": r.id,
                "category_name": r.name,
                "total_quantity": int(r.total_quantity or 0),
                "total_revenue": float(r.total_revenue or 0),
                "product_count": int(r.product_count or 0),
            }
            for r in rows
        ]

    async def get_payment_method_breakdown(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        query = select(Sale.payment_method, func.count(Sale.id).label("orders"), func.sum(Sale.total_amount).label("revenue")).where(Sale.company_id == company_id).group_by(Sale.payment_method)
        query = self._apply_sale_filters(query, company_id, filters)
        result = await db.execute(query)
        rows = result.all()
        total = sum(float(r.revenue or 0) for r in rows) or 1
        return [
            {
                "payment_method": r.payment_method.value if hasattr(r.payment_method, 'value') else str(r.payment_method),
                "total_orders": int(r.orders or 0),
                "total_revenue": float(r.revenue or 0),
                "percentage": round((float(r.revenue or 0) / total) * 100, 2),
            }
            for r in rows
        ]

    async def get_sales_channel_breakdown(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        query = select(Sale.sales_channel, func.count(Sale.id).label("orders"), func.sum(Sale.total_amount).label("revenue")).where(Sale.company_id == company_id).group_by(Sale.sales_channel)
        query = self._apply_sale_filters(query, company_id, filters)
        result = await db.execute(query)
        rows = result.all()
        total = sum(float(r.revenue or 0) for r in rows) or 1
        return [
            {
                "sales_channel": r.sales_channel.value if hasattr(r.sales_channel, 'value') else str(r.sales_channel),
                "total_orders": int(r.orders or 0),
                "total_revenue": float(r.revenue or 0),
                "percentage": round((float(r.revenue or 0) / total) * 100, 2),
            }
            for r in rows
        ]

    async def get_inventory_distribution(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        products_query = select(Product).where(Product.company_id == company_id)
        if filters:
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if category_id:
                products_query = products_query.where(Product.category_id == category_id)
            if brand:
                products_query = products_query.where(Product.brand.ilike(f"%{brand}%"))
        products_result = await db.execute(products_query)
        products = list(products_result.scalars().all())

        cat_map = {}
        for p in products:
            cat_name = None
            if p.category_id:
                cat = await db.get(Category, p.category_id)
                cat_name = cat.name if cat else "Uncategorized"
            else:
                cat_name = "Uncategorized"
            entry = cat_map.setdefault(cat_name, {"category_id": p.category_id, "product_count": 0, "total_stock": 0, "total_value": 0.0})
            entry["product_count"] += 1
            entry["total_stock"] += p.stock_quantity
            entry["total_value"] += float(p.cost_price * p.stock_quantity)

        return [
            {
                "category_id": v["category_id"],
                "category_name": k,
                "product_count": v["product_count"],
                "total_stock": v["total_stock"],
                "total_value": round(v["total_value"], 2),
            }
            for k, v in cat_map.items()
        ]

    async def get_stock_status_summary(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        products_query = select(Product).where(Product.company_id == company_id)
        if filters:
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if category_id:
                products_query = products_query.where(Product.category_id == category_id)
            if brand:
                products_query = products_query.where(Product.brand.ilike(f"%{brand}%"))
        products_result = await db.execute(products_query)
        products = list(products_result.scalars().all())

        status_map = {"IN_STOCK": 0, "LOW_STOCK": 0, "OUT_OF_STOCK": 0}
        for p in products:
            available = p.stock_quantity - p.reserved_stock
            status = self._get_stock_status(available, p.low_stock_threshold)
            status_map[status] += 1

        total = sum(status_map.values()) or 1
        return [
            {"status": k, "product_count": v, "percentage": round((v / total) * 100, 2)}
            for k, v in status_map.items()
        ]

    async def get_low_stock_products(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, limit: int = 20) -> List[dict]:
        products_query = select(Product).where(Product.company_id == company_id)
        if filters:
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if category_id:
                products_query = products_query.where(Product.category_id == category_id)
            if brand:
                products_query = products_query.where(Product.brand.ilike(f"%{brand}%"))
        products_result = await db.execute(products_query)
        products = list(products_result.scalars().all())

        low_stock = []
        for p in products:
            available = p.stock_quantity - p.reserved_stock
            if 0 < available <= p.low_stock_threshold:
                low_stock.append(p)
            elif available == 0 and p.stock_quantity == 0:
                pass

        low_stock.sort(key=lambda p: (p.stock_quantity - p.reserved_stock))
        result = []
        for p in low_stock[:limit]:
            available = p.stock_quantity - p.reserved_stock
            cat_name = None
            if p.category_id:
                cat = await db.get(Category, p.category_id)
                cat_name = cat.name if cat else None
            result.append({
                "product_id": p.id,
                "product_name": p.name,
                "sku": p.sku,
                "category_name": cat_name,
                "brand": p.brand,
                "stock_quantity": p.stock_quantity,
                "available_stock": available,
                "low_stock_threshold": p.low_stock_threshold,
                "unit_price": float(p.unit_price),
                "inventory_value": float(p.cost_price * p.stock_quantity),
            })
        return result

    async def get_out_of_stock_products(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, limit: int = 50) -> List[dict]:
        products_query = select(Product).where(Product.company_id == company_id)
        if filters:
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if category_id:
                products_query = products_query.where(Product.category_id == category_id)
            if brand:
                products_query = products_query.where(Product.brand.ilike(f"%{brand}%"))
        products_result = await db.execute(products_query)
        products = list(products_result.scalars().all())

        out_of_stock = []
        for p in products:
            available = p.stock_quantity - p.reserved_stock
            if available == 0:
                out_of_stock.append(p)

        result = []
        for p in out_of_stock[:limit]:
            cat_name = None
            if p.category_id:
                cat = await db.get(Category, p.category_id)
                cat_name = cat.name if cat else None

            last_sale_result = await db.execute(
                select(Sale.sale_date)
                .join(SaleItem, Sale.id == SaleItem.sale_id)
                .where(Sale.company_id == company_id)
                .where(SaleItem.product_id == p.id)
                .where(Sale.status == SaleStatus.COMPLETED)
                .order_by(Sale.sale_date.desc())
                .limit(1)
            )
            last_sale = last_sale_result.scalar_one_or_none()

            result.append({
                "product_id": p.id,
                "product_name": p.name,
                "sku": p.sku,
                "category_name": cat_name,
                "brand": p.brand,
                "last_sale_date": last_sale,
                "unit_price": float(p.unit_price),
            })
        return result

    async def get_inventory_value_by_category(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        products_query = select(Product).where(Product.company_id == company_id)
        if filters:
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if category_id:
                products_query = products_query.where(Product.category_id == category_id)
            if brand:
                products_query = products_query.where(Product.brand.ilike(f"%{brand}%"))
        products_result = await db.execute(products_query)
        products = list(products_result.scalars().all())

        cat_map = {}
        for p in products:
            cat_name = None
            if p.category_id:
                cat = await db.get(Category, p.category_id)
                cat_name = cat.name if cat else "Uncategorized"
            else:
                cat_name = "Uncategorized"
            entry = cat_map.setdefault(cat_name, {"category_id": p.category_id, "total_products": 0, "total_stock": 0, "total_cost_value": 0.0, "total_retail_value": 0.0})
            entry["total_products"] += 1
            entry["total_stock"] += p.stock_quantity
            entry["total_cost_value"] += float(p.cost_price * p.stock_quantity)
            entry["total_retail_value"] += float(p.unit_price * p.stock_quantity)

        return [
            {
                "category_id": v["category_id"],
                "category_name": k,
                "total_products": v["total_products"],
                "total_stock": v["total_stock"],
                "total_cost_value": round(v["total_cost_value"], 2),
                "total_retail_value": round(v["total_retail_value"], 2),
            }
            for k, v in cat_map.items()
        ]

    async def drill_down_transactions(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        query = select(Sale).where(Sale.company_id == company_id).options(selectinload(Sale.items))
        query = self._apply_sale_filters(query, company_id, filters)
        result = await db.execute(query)
        sales = list(result.scalars().all())
        return [
            {
                "id": s.id,
                "invoice_number": s.invoice_number,
                "sale_date": s.sale_date.isoformat(),
                "customer_name": s.customer_name,
                "sales_channel": s.sales_channel.value if hasattr(s.sales_channel, 'value') else str(s.sales_channel),
                "payment_method": s.payment_method.value if hasattr(s.payment_method, 'value') else str(s.payment_method),
                "total_amount": float(s.total_amount),
                "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
                "items": [
                    {
                        "product_id": it.product_id,
                        "quantity": it.quantity,
                        "unit_price": float(it.unit_price),
                        "total": float(it.total),
                        "product_name": it.product.name if it.product else None,
                    }
                    for it in s.items
                ],
            }
            for s in sales
        ]

    async def drill_down_products(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        query = (
            select(
                Product.id,
                Product.name,
                Product.sku,
                Product.stock_quantity,
                Product.unit_price,
                Category.name.label("category_name"),
                Product.brand,
                func.sum(SaleItem.quantity).label("total_sold"),
                func.sum(SaleItem.total).label("total_revenue"),
            )
            .outerjoin(SaleItem, Product.id == SaleItem.product_id)
            .outerjoin(Sale, SaleItem.sale_id == Sale.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .where(Product.company_id == company_id)
            .group_by(Product.id, Category.name)
        )
        if filters:
            category_id = filters.get("category_id")
            brand = filters.get("brand")
            if category_id:
                query = query.where(Product.category_id == category_id)
            if brand:
                query = query.where(Product.brand.ilike(f"%{brand}%"))

        result = await db.execute(query)
        rows = result.all()
        return [
            {
                "product_id": r.id,
                "product_name": r.name,
                "sku": r.sku,
                "category_name": r.category_name,
                "brand": r.brand,
                "stock_quantity": r.stock_quantity,
                "unit_price": float(r.unit_price),
                "total_sold": int(r.total_sold or 0),
                "total_revenue": float(r.total_revenue or 0),
            }
            for r in rows
        ]

    async def drill_down_category_products(self, db: AsyncSession, company_id: UUID, category_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        query = (
            select(
                Product.id,
                Product.name,
                Product.sku,
                Product.brand,
                Product.stock_quantity,
                Product.reserved_stock,
                Product.unit_price,
                Product.cost_price,
                Product.low_stock_threshold,
                func.coalesce(func.sum(SaleItem.quantity), 0).label("total_sold"),
                func.coalesce(func.sum(SaleItem.total), 0).label("total_revenue"),
            )
            .outerjoin(SaleItem, Product.id == SaleItem.product_id)
            .outerjoin(Sale, SaleItem.sale_id == Sale.id)
            .where(Product.company_id == company_id)
            .where(Product.category_id == category_id)
            .group_by(Product.id)
        )
        if filters:
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            sales_channel = filters.get("sales_channel")
            payment_method = filters.get("payment_method")
            brand = filters.get("brand")
            if date_from:
                query = query.where(Sale.sale_date >= date_from)
            if date_to:
                query = query.where(Sale.sale_date <= date_to)
            if sales_channel:
                query = query.where(Sale.sales_channel == sales_channel)
            if payment_method:
                query = query.where(Sale.payment_method == payment_method)
            if brand:
                query = query.where(Product.brand.ilike(f"%{brand}%"))

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "product_id": r.id,
                "product_name": r.name,
                "sku": r.sku,
                "brand": r.brand,
                "stock_quantity": r.stock_quantity,
                "available_stock": r.stock_quantity - r.reserved_stock,
                "unit_price": float(r.unit_price),
                "cost_price": float(r.cost_price),
                "low_stock_threshold": r.low_stock_threshold,
                "stock_status": self._get_stock_status(r.stock_quantity - r.reserved_stock, r.low_stock_threshold),
                "total_sold": int(r.total_sold or 0),
                "total_revenue": float(r.total_revenue or 0),
            }
            for r in rows
        ]

    async def drill_down_product_transactions(self, db: AsyncSession, company_id: UUID, product_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        query = (
            select(Sale, SaleItem)
            .join(SaleItem, Sale.id == SaleItem.sale_id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.product_id == product_id)
        )
        if filters:
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            if date_from:
                query = query.where(Sale.sale_date >= date_from)
            if date_to:
                query = query.where(Sale.sale_date <= date_to)
            sales_channel = filters.get("sales_channel")
            if sales_channel:
                query = query.where(Sale.sales_channel == sales_channel)
            payment_method = filters.get("payment_method")
            if payment_method:
                query = query.where(Sale.payment_method == payment_method)

        query = query.order_by(Sale.sale_date.desc())
        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "id": s.id,
                "invoice_number": s.invoice_number,
                "sale_date": s.sale_date.isoformat(),
                "customer_name": s.customer_name,
                "sales_channel": s.sales_channel.value if hasattr(s.sales_channel, 'value') else str(s.sales_channel),
                "payment_method": s.payment_method.value if hasattr(s.payment_method, 'value') else str(s.payment_method),
                "total_amount": float(s.total_amount),
                "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
                "items": [
                    {
                        "product_id": it.product_id,
                        "quantity": it.quantity,
                        "unit_price": float(it.unit_price),
                        "total": float(it.total),
                        "product_name": it.product.name if it.product else None,
                    }
                    for it in s.items
                ],
            }
            for s, it in rows
        ]

    async def drill_down_kpi_detail(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> dict:
        detail_filters = dict(filters) if filters else {}
        transactions = await self.drill_down_transactions(db, company_id, detail_filters)
        products = await self.drill_down_products(db, company_id, detail_filters)
        low_stock = await self.get_low_stock_products(db, company_id, detail_filters, 50)
        out_of_stock = await self.get_out_of_stock_products(db, company_id, detail_filters, 50)

        return {
            "transactions": transactions,
            "products": products,
            "low_stock_products": low_stock,
            "out_of_stock_products": out_of_stock,
        }

    async def log_analytics_event(self, db: AsyncSession, company_id: UUID, user_id: UUID, action: str, request, entity_name: str = "", details: Optional[str] = None, export_type: Optional[str] = None):
        await audit_service.log(
            db,
            company_id=company_id,
            user_id=user_id,
            action=action,
            request=request,
            entity_name=entity_name,
            details=details,
        )


analytics_service = AnalyticsService()
