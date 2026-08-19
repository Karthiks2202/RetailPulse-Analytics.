from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, date
from decimal import Decimal
from uuid import UUID
from typing import Optional, List
from app.models.sale import Sale, SaleItem, SaleStatus, SalesChannel, PaymentMethod
from app.models.product import Product, ProductStatus
from app.models.category import Category
from app.models.customer import Customer
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

    def _split_filters(self, filters: Optional[dict]):
        sale_filters = {}
        item_filters = {}
        if filters:
            for key in ["date_from", "date_to", "sales_channel", "payment_method", "customer_id"]:
                if filters.get(key):
                    sale_filters[key] = filters[key]
            for key in ["product_id", "category_id", "brand"]:
                if filters.get(key):
                    item_filters[key] = filters[key]
        return sale_filters, item_filters

    def _apply_sale_level_filters(self, query, sale_filters: dict):
        if sale_filters.get("date_from"):
            query = query.where(Sale.sale_date >= sale_filters["date_from"])
        if sale_filters.get("date_to"):
            query = query.where(Sale.sale_date <= sale_filters["date_to"])
        if sale_filters.get("sales_channel"):
            query = query.where(Sale.sales_channel == sale_filters["sales_channel"])
        if sale_filters.get("payment_method"):
            query = query.where(Sale.payment_method == sale_filters["payment_method"])
        if sale_filters.get("customer_id"):
            query = query.where(Sale.customer_id == sale_filters["customer_id"])
        return query

    def _apply_item_level_filters(self, query, item_filters: dict):
        if item_filters.get("product_id"):
            query = query.where(SaleItem.product_id == item_filters["product_id"])
        if item_filters.get("category_id"):
            query = query.where(SaleItem.category_id == item_filters["category_id"])
        if item_filters.get("brand"):
            query = query.join(Product, SaleItem.product_id == Product.id).where(Product.brand.ilike(f"%{item_filters['brand']}%"))
        return query

    def _apply_sale_filters(self, query, company_id: UUID, filters: Optional[dict]):
        query = query.where(Sale.company_id == company_id).where(Sale.status == SaleStatus.COMPLETED)
        if not filters:
            return query

        date_from = filters.get("date_from")
        date_to = filters.get("date_to")
        product_id = filters.get("product_id")
        category_id = filters.get("category_id")
        brand = filters.get("brand")
        sales_channel = filters.get("sales_channel")
        payment_method = filters.get("payment_method")
        customer_id = filters.get("customer_id")

        if date_from:
            query = query.where(Sale.sale_date >= date_from)
        if date_to:
            query = query.where(Sale.sale_date <= date_to)
        if sales_channel:
            query = query.where(Sale.sales_channel == sales_channel)
        if payment_method:
            query = query.where(Sale.payment_method == payment_method)
        if customer_id:
            query = query.where(Sale.customer_id == customer_id)

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
        sale_query = select(Sale).where(Sale.company_id == company_id).where(Sale.status == SaleStatus.COMPLETED)

        sale_filters, item_filters = self._split_filters(filters)
        sale_query = self._apply_sale_level_filters(sale_query, sale_filters)
        sale_sub = sale_query.subquery()

        total_orders_result = await db.execute(
            select(func.count(sale_sub.c.id))
        )
        total_orders = total_orders_result.scalar() or 0

        item_agg = select(
            func.coalesce(func.sum(SaleItem.total), 0).label("total_revenue"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("total_quantity"),
            func.coalesce(func.sum(SaleItem.discount), 0).label("total_discount"),
            func.coalesce(func.sum(SaleItem.tax), 0).label("total_tax"),
        ).join(sale_sub, SaleItem.sale_id == sale_sub.c.id)

        item_agg = self._apply_item_level_filters(item_agg, item_filters)

        result = await db.execute(item_agg)
        row = result.one()
        total_revenue = float(row.total_revenue or 0)
        total_products_sold = int(row.total_quantity or 0)
        total_discount = float(row.total_discount or 0)
        total_tax = float(row.total_tax or 0)

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
            "total_discount": total_discount,
            "total_tax": total_tax,
            "total_inventory_value": total_inventory_value,
            "low_stock_products": low_stock_products,
            "out_of_stock_products": out_of_stock_products,
            "total_categories": total_categories,
        }

    def _generate_date_range(self, start: datetime, end: datetime, interval: str) -> List[datetime]:
        dates = []
        current = start.date() if isinstance(start, datetime) else start
        end_date = end.date() if isinstance(end, datetime) else end
        if interval == "weekly":
            current -= timedelta(days=current.weekday())
        while current <= end_date:
            dates.append(current)
            if interval == "daily":
                current += timedelta(days=1)
            elif interval == "weekly":
                current += timedelta(weeks=1)
            elif interval == "monthly":
                month = current.month - 1 + 1
                year = current.year + month // 12
                month = month % 12 + 1
                day = min(current.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
                current = date(year, month, day)
            else:
                current += timedelta(days=1)
        return dates

    def _format_period(self, d: date, interval: str) -> str:
        if interval == "daily":
            return d.strftime("%Y-%m-%d")
        elif interval == "weekly":
            return d.strftime("%Y-%m-%d")
        elif interval == "monthly":
            return d.strftime("%Y-%m")
        return d.strftime("%Y-%m-%d")

    async def get_revenue_trend(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, interval: str = "daily") -> List[dict]:
        trunc_map = {"daily": "day", "weekly": "week", "monthly": "month"}
        fmt_map = {"daily": "YYYY-MM-DD", "weekly": "YYYY-MM-DD", "monthly": "YYYY-MM"}
        trunc = trunc_map.get(interval, "day")
        fmt = fmt_map.get(interval, "YYYY-MM-DD")

        sale_query = select(Sale).where(Sale.company_id == company_id).where(Sale.status == SaleStatus.COMPLETED)

        sale_filters, item_filters = self._split_filters(filters)
        sale_query = self._apply_sale_level_filters(sale_query, sale_filters)
        sale_sub = sale_query.subquery()
        has_item_filter = bool(item_filters)

        if has_item_filter:
            query = (
                select(
                    func.to_char(func.date_trunc(trunc, sale_sub.c.sale_date), fmt).label("period"),
                    func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
                    func.count(func.distinct(sale_sub.c.id)).label("orders"),
                )
                .join(SaleItem, SaleItem.sale_id == sale_sub.c.id)
            )
            query = self._apply_item_level_filters(query, item_filters)
            query = query.group_by(func.date_trunc(trunc, sale_sub.c.sale_date)).order_by("period")
        else:
            query = (
                select(
                    func.to_char(func.date_trunc(trunc, Sale.sale_date), fmt).label("period"),
                    func.coalesce(func.sum(Sale.total_amount), 0).label("revenue"),
                    func.count(Sale.id).label("orders"),
                )
                .where(Sale.company_id == company_id)
                .where(Sale.status == SaleStatus.COMPLETED)
            )
            query = self._apply_sale_level_filters(query, sale_filters)
            query = query.group_by(func.date_trunc(trunc, Sale.sale_date)).order_by("period")

        result = await db.execute(query)
        rows = result.all()
        data_map = {r.period: {"period": r.period, "revenue": float(r.revenue or 0), "orders": int(r.orders or 0)} for r in rows}

        date_from = filters.get("date_from") if filters else None
        date_to = filters.get("date_to") if filters else None
        start = date_from or (datetime.utcnow() - timedelta(days=30))
        end = date_to or datetime.utcnow()

        all_periods = self._generate_date_range(start, end, interval)
        result_list = []
        for d in all_periods:
            period_key = self._format_period(d, interval)
            if period_key in data_map:
                result_list.append(data_map[period_key])
            else:
                result_list.append({"period": period_key, "revenue": 0.0, "orders": 0})
        return result_list

    async def get_sales_trend(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, interval: str = "daily") -> List[dict]:
        trunc_map = {"daily": "day", "weekly": "week", "monthly": "month"}
        fmt_map = {"daily": "YYYY-MM-DD", "weekly": "YYYY-MM-DD", "monthly": "YYYY-MM"}
        trunc = trunc_map.get(interval, "day")
        fmt = fmt_map.get(interval, "YYYY-MM-DD")

        sale_query = select(Sale).where(Sale.company_id == company_id).where(Sale.status == SaleStatus.COMPLETED)

        sale_filters, item_filters = self._split_filters(filters)
        sale_query = self._apply_sale_level_filters(sale_query, sale_filters)
        sale_sub = sale_query.subquery()
        has_item_filter = bool(item_filters)

        if has_item_filter:
            query = (
                select(
                    func.to_char(func.date_trunc(trunc, sale_sub.c.sale_date), fmt).label("period"),
                    func.coalesce(func.sum(SaleItem.total), 0).label("sales"),
                    func.count(func.distinct(sale_sub.c.id)).label("orders"),
                )
                .join(SaleItem, SaleItem.sale_id == sale_sub.c.id)
            )
            query = self._apply_item_level_filters(query, item_filters)
            query = query.group_by(func.date_trunc(trunc, sale_sub.c.sale_date)).order_by("period")
        else:
            query = (
                select(
                    func.to_char(func.date_trunc(trunc, Sale.sale_date), fmt).label("period"),
                    func.coalesce(func.sum(Sale.total_amount), 0).label("sales"),
                    func.coalesce(func.count(func.distinct(Sale.id)), 0).label("orders"),
                )
                .where(Sale.company_id == company_id)
                .where(Sale.status == SaleStatus.COMPLETED)
            )
            query = self._apply_sale_level_filters(query, sale_filters)
            query = query.group_by(func.date_trunc(trunc, Sale.sale_date)).order_by("period")

        result = await db.execute(query)
        rows = result.all()
        data_map = {r.period: {"period": r.period, "sales": float(r.sales or 0), "orders": int(r.orders or 0)} for r in rows}

        date_from = filters.get("date_from") if filters else None
        date_to = filters.get("date_to") if filters else None
        start = date_from or (datetime.utcnow() - timedelta(days=30))
        end = date_to or datetime.utcnow()

        all_periods = self._generate_date_range(start, end, interval)
        result_list = []
        for d in all_periods:
            period_key = self._format_period(d, interval)
            if period_key in data_map:
                result_list.append(data_map[period_key])
            else:
                result_list.append({"period": period_key, "sales": 0.0, "orders": 0})
        return result_list

    async def get_top_products(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, page: int = 1, page_size: int = 10, sort_by: Optional[str] = None, sort_order: Optional[str] = "desc") -> dict:
        sort_by = sort_by or "total_quantity"
        sort_order = sort_order or "desc"
        sort_column = func.sum(SaleItem.total) if sort_by == "total_revenue" else func.sum(SaleItem.quantity)

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
            .order_by(sort_column.desc() if sort_order == "desc" else sort_column.asc())
        )
        if filters:
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            sales_channel = filters.get("sales_channel")
            payment_method = filters.get("payment_method")
            customer_id = filters.get("customer_id")
            product_id = filters.get("product_id")
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
            if customer_id:
                query = query.where(Sale.customer_id == customer_id)
            if product_id:
                query = query.where(SaleItem.product_id == product_id)
            if category_id:
                query = query.where(SaleItem.category_id == category_id)
            if brand:
                query = query.where(Product.brand.ilike(f"%{brand}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        rows = result.all()
        return {
            "items": [
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
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_top_categories(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, page: int = 1, page_size: int = 10) -> dict:
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
        )
        if filters:
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            sales_channel = filters.get("sales_channel")
            payment_method = filters.get("payment_method")
            customer_id = filters.get("customer_id")
            brand = filters.get("brand")
            if date_from:
                query = query.where(Sale.sale_date >= date_from)
            if date_to:
                query = query.where(Sale.sale_date <= date_to)
            if sales_channel:
                query = query.where(Sale.sales_channel == sales_channel)
            if payment_method:
                query = query.where(Sale.payment_method == payment_method)
            if customer_id:
                query = query.where(Sale.customer_id == customer_id)
            if brand:
                query = query.where(Product.brand.ilike(f"%{brand}%"))

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        rows = result.all()
        return {
            "items": [
                {
                    "category_id": r.id,
                    "category_name": r.name,
                    "total_quantity": int(r.total_quantity or 0),
                    "total_revenue": float(r.total_revenue or 0),
                    "product_count": int(r.product_count or 0),
                }
                for r in rows
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_payment_method_breakdown(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None) -> List[dict]:
        sale_query = select(Sale).where(Sale.company_id == company_id).where(Sale.status == SaleStatus.COMPLETED)

        sale_filters, item_filters = self._split_filters(filters)
        sale_query = self._apply_sale_level_filters(sale_query, sale_filters)
        sale_sub = sale_query.subquery()
        has_item_filter = bool(item_filters)

        if has_item_filter:
            query = (
                select(
                    sale_sub.c.payment_method,
                    func.count(func.distinct(sale_sub.c.id)).label("orders"),
                    func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
                )
                .join(SaleItem, SaleItem.sale_id == sale_sub.c.id)
                .group_by(sale_sub.c.payment_method)
            )
            query = self._apply_item_level_filters(query, item_filters)
        else:
            query = (
                select(Sale.payment_method, func.count(Sale.id).label("orders"), func.sum(Sale.total_amount).label("revenue"))
                .where(Sale.company_id == company_id)
                .where(Sale.status == SaleStatus.COMPLETED)
                .group_by(Sale.payment_method)
            )
            query = self._apply_sale_level_filters(query, sale_filters)

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
        sale_query = select(Sale).where(Sale.company_id == company_id).where(Sale.status == SaleStatus.COMPLETED)

        sale_filters, item_filters = self._split_filters(filters)
        sale_query = self._apply_sale_level_filters(sale_query, sale_filters)
        sale_sub = sale_query.subquery()
        has_item_filter = bool(item_filters)

        if has_item_filter:
            query = (
                select(
                    sale_sub.c.sales_channel,
                    func.count(func.distinct(sale_sub.c.id)).label("orders"),
                    func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
                )
                .join(SaleItem, SaleItem.sale_id == sale_sub.c.id)
                .group_by(sale_sub.c.sales_channel)
            )
            query = self._apply_item_level_filters(query, item_filters)
        else:
            query = (
                select(Sale.sales_channel, func.count(Sale.id).label("orders"), func.sum(Sale.total_amount).label("revenue"))
                .where(Sale.company_id == company_id)
                .where(Sale.status == SaleStatus.COMPLETED)
                .group_by(Sale.sales_channel)
            )
            query = self._apply_sale_level_filters(query, sale_filters)

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
            customer_id = filters.get("customer_id")
            brand = filters.get("brand")
            if date_from:
                query = query.where(Sale.sale_date >= date_from)
            if date_to:
                query = query.where(Sale.sale_date <= date_to)
            if sales_channel:
                query = query.where(Sale.sales_channel == sales_channel)
            if payment_method:
                query = query.where(Sale.payment_method == payment_method)
            if customer_id:
                query = query.where(Sale.customer_id == customer_id)
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
            .where(Sale.status == SaleStatus.COMPLETED)
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
            customer_id = filters.get("customer_id")
            if customer_id:
                query = query.where(Sale.customer_id == customer_id)

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

    async def get_top_customers(self, db: AsyncSession, company_id: UUID, filters: Optional[dict] = None, page: int = 1, page_size: int = 10) -> dict:
        sale_query = (
            select(Sale)
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
        )

        sale_filters, item_filters = self._split_filters(filters)
        sale_query = self._apply_sale_level_filters(sale_query, sale_filters)
        sale_sub = sale_query.subquery()
        has_item_filter = bool(item_filters)

        count_query = select(func.count(func.distinct(sale_sub.c.customer_id)))
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        if has_item_filter:
            item_sub = select(
                SaleItem.sale_id,
                SaleItem.total,
            ).join(sale_sub, SaleItem.sale_id == sale_sub.c.id)
            item_sub = self._apply_item_level_filters(item_sub, item_filters)
            item_sub = item_sub.subquery()

            query = (
                select(
                    sale_sub.c.customer_id,
                    func.count(func.distinct(item_sub.c.sale_id)).label("total_purchases"),
                    func.coalesce(func.sum(item_sub.c.total), 0).label("total_spent"),
                    func.max(sale_sub.c.sale_date).label("last_purchase_date"),
                )
                .join(item_sub, sale_sub.c.id == item_sub.c.sale_id)
                .group_by(sale_sub.c.customer_id)
                .order_by(func.sum(item_sub.c.total).desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        else:
            query = (
                select(
                    sale_sub.c.customer_id,
                    func.count(sale_sub.c.id).label("total_purchases"),
                    func.coalesce(func.sum(sale_sub.c.total_amount), 0).label("total_spent"),
                    func.avg(sale_sub.c.total_amount).label("average_order_value"),
                    func.max(sale_sub.c.sale_date).label("last_purchase_date"),
                )
                .group_by(sale_sub.c.customer_id)
                .order_by(func.sum(sale_sub.c.total_amount).desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )

        result = await db.execute(query)
        rows = result.all()
        customer_ids = [row.customer_id for row in rows]

        customers = {}
        if customer_ids:
            customers_result = await db.execute(
                select(Customer).where(Customer.id.in_(customer_ids))
            )
            for c in customers_result.scalars().all():
                customers[c.id] = c

        items = []
        for row in rows:
            total_spent = float(row.total_spent or 0)
            total_purchases = int(row.total_purchases or 0)
            average_order_value = total_spent / total_purchases if total_purchases > 0 else 0.0
            items.append({
                "id": row.customer_id,
                "first_name": customers[row.customer_id].first_name if row.customer_id in customers else "",
                "last_name": customers[row.customer_id].last_name if row.customer_id in customers else "",
                "email": customers[row.customer_id].email if row.customer_id in customers else None,
                "total_purchases": total_purchases,
                "total_spent": total_spent,
                "average_order_value": average_order_value,
                "last_purchase_date": row.last_purchase_date,
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
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
