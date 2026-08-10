from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.orm import selectinload
from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.product import Product
from app.models.category import Category
from uuid import UUID
from datetime import datetime
import csv
import io


class CRUDCustomer:
    async def get(self, db: AsyncSession, customer_id: UUID) -> Customer | None:
        result = await db.execute(select(Customer).where(Customer.id == customer_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, db: AsyncSession, company_id: UUID, email: str) -> Customer | None:
        result = await db.execute(
            select(Customer).where(Customer.company_id == company_id).where(Customer.email == email).where(Customer.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, db: AsyncSession, company_id: UUID, phone: str) -> Customer | None:
        result = await db.execute(
            select(Customer).where(Customer.company_id == company_id).where(Customer.phone == phone).where(Customer.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
        status: CustomerStatus | None = None,
        customer_type: CustomerType | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        segment: str | None = None,
    ) -> tuple[list[Customer], int]:
        query = select(Customer).where(Customer.company_id == company_id).where(Customer.is_deleted == False)

        if search:
            search = search.strip()
            conditions = [
                Customer.first_name.ilike(f"%{search}%"),
                Customer.last_name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
                Customer.city.ilike(f"%{search}%"),
                Customer.state.ilike(f"%{search}%"),
                Customer.country.ilike(f"%{search}%"),
            ]
            try:
                search_uuid = UUID(search)
                conditions.append(Customer.id == search_uuid)
            except ValueError:
                pass
            query = query.where(or_(*conditions))

        if status:
            query = query.where(Customer.status == status)

        if customer_type:
            query = query.where(Customer.customer_type == customer_type)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        allowed_sort_fields = {
            "created_at", "first_name", "last_name", "customer_type", "total_spent",
            "total_orders", "last_purchase_date", "customer_since", "name",
        }

        sort_mapping = {
            "created_at": Customer.created_at,
            "first_name": Customer.first_name,
            "last_name": Customer.last_name,
            "customer_type": Customer.customer_type,
            "total_spent": Customer.id,
            "total_orders": Customer.id,
            "last_purchase_date": Customer.id,
            "customer_since": Customer.customer_since,
            "name": Customer.first_name,
        }

        if sort_by in allowed_sort_fields and sort_by in sort_mapping:
            column = sort_mapping[sort_by]
            if sort_dir == "asc":
                query = query.order_by(asc(column))
            else:
                query = query.order_by(desc(column))

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        customers = list(result.scalars().all())

        if sort_by in {"total_spent", "total_orders", "last_purchase_date"}:
            customer_ids = [c.id for c in customers]
            if customer_ids:
                if sort_by == "total_spent":
                    summary_rows = (
                        select(
                            Sale.customer_id.label("customer_id"),
                            func.coalesce(func.sum(Sale.total_amount), 0).label("value"),
                        )
                        .where(Sale.company_id == company_id)
                        .where(Sale.status == SaleStatus.COMPLETED)
                        .where(Sale.customer_id.in_(customer_ids))
                        .group_by(Sale.customer_id)
                    )
                elif sort_by == "total_orders":
                    summary_rows = (
                        select(
                            Sale.customer_id.label("customer_id"),
                            func.count(Sale.id).label("value"),
                        )
                        .where(Sale.company_id == company_id)
                        .where(Sale.status == SaleStatus.COMPLETED)
                        .where(Sale.customer_id.in_(customer_ids))
                        .group_by(Sale.customer_id)
                    )
                else:
                    summary_rows = (
                        select(
                            Sale.customer_id.label("customer_id"),
                            func.max(Sale.sale_date).label("value"),
                        )
                        .where(Sale.company_id == company_id)
                        .where(Sale.status == SaleStatus.COMPLETED)
                        .where(Sale.customer_id.in_(customer_ids))
                        .group_by(Sale.customer_id)
                    )

                summary_result = await db.execute(summary_rows)
                summary_map = {row.customer_id: row.value for row in summary_result.all()}

                customers.sort(
                    key=lambda c: summary_map.get(c.id) or 0,
                    reverse=(sort_dir == "desc"),
                )

        return customers, total

    async def create(
        self,
        db: AsyncSession,
        company_id: UUID,
        first_name: str,
        last_name: str,
        email: str | None,
        phone: str | None,
        date_of_birth: datetime | None,
        gender: str | None,
        address: str | None,
        city: str | None,
        state: str | None,
        country: str | None,
        postal_code: str | None,
        customer_type: str,
        preferred_sales_channel: str | None,
        notes: str | None,
        status: str,
    ) -> Customer:
        customer = Customer(
            company_id=company_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            date_of_birth=date_of_birth,
            gender=gender,
            address=address,
            city=city,
            state=state,
            country=country,
            postal_code=postal_code,
            customer_type=customer_type,
            preferred_sales_channel=preferred_sales_channel,
            notes=notes,
            status=status,
        )
        db.add(customer)
        await db.commit()
        await db.refresh(customer)
        return customer

    async def update(self, db: AsyncSession, customer: Customer, **kwargs) -> Customer:
        for key, value in kwargs.items():
            if value is not None and hasattr(customer, key):
                setattr(customer, key, value)
        await db.commit()
        await db.refresh(customer)
        return customer

    async def delete(self, db: AsyncSession, customer: Customer) -> None:
        customer.is_deleted = True
        await db.commit()

    async def get_segment(self, db: AsyncSession, customer_id: UUID) -> str:
        result = await db.execute(
            select(
                func.count(Sale.id).label("total_orders"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_spent"),
            )
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        row = result.one_or_none()
        orders = int(row.total_orders) if row else 0
        spent = float(row.total_spent or 0) if row else 0.0

        if orders >= 10 and spent >= 5000:
            return "VIP"
        if orders >= 5 and spent >= 1000:
            return "LOYAL"
        if orders >= 2:
            return "REGULAR"
        return "NEW"

    async def get_purchase_summary(self, db: AsyncSession, customer_id: UUID) -> dict:
        result = await db.execute(
            select(
                func.count(Sale.id).label("total_purchases"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_spent"),
            )
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        row = result.one_or_none()
        total_purchases = int(row.total_purchases) if row else 0
        total_spent = float(row.total_spent) if row else 0.0

        last_purchase_result = await db.execute(
            select(Sale.sale_date)
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .order_by(Sale.sale_date.desc())
            .limit(1)
        )
        last_purchase = last_purchase_result.scalar_one_or_none()

        return {
            "total_purchases": total_purchases,
            "total_spent": total_spent,
            "last_purchase_date": last_purchase,
        }

    async def get_purchase_history(self, db: AsyncSession, customer_id: UUID, skip: int = 0, limit: int = 50) -> tuple[list[Sale], int]:
        query = (
            select(Sale)
            .where(Sale.customer_id == customer_id)
            .order_by(Sale.sale_date.desc())
        )

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def get_top_customers(self, db: AsyncSession, company_id: UUID, limit: int = 10) -> list[dict]:
        query = (
            select(
                Sale.customer_id.label("customer_id"),
                func.count(Sale.id).label("total_purchases"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_spent"),
                func.max(Sale.sale_date).label("last_purchase_date"),
            )
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
            .order_by(func.sum(Sale.total_amount).desc())
            .limit(limit)
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

        return [
            {
                "id": row.customer_id,
                "first_name": customers[row.customer_id].first_name if row.customer_id in customers else "",
                "last_name": customers[row.customer_id].last_name if row.customer_id in customers else "",
                "email": customers[row.customer_id].email if row.customer_id in customers else None,
                "total_purchases": int(row.total_purchases),
                "total_spent": float(row.total_spent),
                "last_purchase_date": row.last_purchase_date,
            }
            for row in rows
        ]

    async def get_new_vs_returning(self, db: AsyncSession, company_id: UUID, date_from: datetime | None = None, date_to: datetime | None = None) -> dict:
        query = select(Sale).where(Sale.company_id == company_id).where(Sale.status == SaleStatus.COMPLETED).where(Sale.customer_id.is_not(None))

        if date_from:
            query = query.where(Sale.sale_date >= date_from)
        if date_to:
            query = query.where(Sale.sale_date <= date_to)

        result = await db.execute(query)
        sales = list(result.scalars().all())

        customer_first_dates: dict[UUID, datetime] = {}
        for sale in sales:
            if sale.customer_id not in customer_first_dates:
                customer_first_dates[sale.customer_id] = sale.sale_date
            elif sale.sale_date < customer_first_dates[sale.customer_id]:
                customer_first_dates[sale.customer_id] = sale.sale_date

        new_customers = set()
        returning_customers = set()

        for sale in sales:
            if sale.sale_date == customer_first_dates[sale.customer_id]:
                new_customers.add(sale.customer_id)
            else:
                returning_customers.add(sale.customer_id)

        new_revenue = 0.0
        returning_revenue = 0.0

        for sale in sales:
            if sale.customer_id in new_customers:
                new_revenue += float(sale.total_amount)
            elif sale.customer_id in returning_customers:
                returning_revenue += float(sale.total_amount)

        return {
            "new_customers": len(new_customers),
            "returning_customers": len(returning_customers),
            "new_customer_revenue": round(new_revenue, 2),
            "returning_customer_revenue": round(returning_revenue, 2),
        }

    async def get_purchase_detail(self, db: AsyncSession, customer_id: UUID, recent_limit: int = 10, top_products_limit: int = 5) -> dict:
        totals_result = await db.execute(
            select(
                func.count(Sale.id).label("total_orders"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_revenue"),
                func.avg(Sale.total_amount).label("average_order_value"),
                func.min(Sale.sale_date).label("first_purchase_date"),
                func.max(Sale.sale_date).label("last_purchase_date"),
            )
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        totals_row = totals_result.one_or_none()
        total_orders = int(totals_row.total_orders) if totals_row else 0
        total_revenue = float(totals_row.total_revenue) if totals_row else 0.0
        avg_order_value = float(totals_row.average_order_value) if totals_row and totals_row.average_order_value else 0.0
        first_purchase_date = totals_row.first_purchase_date if totals_row else None
        last_purchase_date = totals_row.last_purchase_date if totals_row else None

        total_quantity_result = await db.execute(
            select(func.coalesce(func.sum(SaleItem.quantity), 0))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        total_quantity_purchased = int(total_quantity_result.scalar() or 0)

        frequent_products_result = await db.execute(
            select(
                SaleItem.product_id.label("product_id"),
                func.sum(SaleItem.quantity).label("total_quantity_purchased"),
                func.sum(SaleItem.total).label("total_revenue"),
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(SaleItem.product_id.is_not(None))
            .group_by(SaleItem.product_id)
            .order_by(func.sum(SaleItem.quantity).desc())
            .limit(top_products_limit)
        )
        frequent_rows = frequent_products_result.all()
        frequent_product_ids = [row.product_id for row in frequent_rows]

        product_names = {}
        if frequent_product_ids:
            products_result = await db.execute(
                select(Product.id, Product.name, Product.sku).where(Product.id.in_(frequent_product_ids))
            )
            for p in products_result.all():
                product_names[p.id] = p

        frequently_purchased_products = [
            {
                "product_id": row.product_id,
                "product_name": product_names[row.product_id].name if row.product_id in product_names else "Unknown Product",
                "sku": product_names[row.product_id].sku if row.product_id in product_names else "",
                "total_quantity_purchased": int(row.total_quantity_purchased),
                "total_revenue": float(row.total_revenue or 0),
            }
            for row in frequent_rows
        ]

        recent_sales_query = (
            select(Sale)
            .options(selectinload(Sale.items))
            .where(Sale.customer_id == customer_id)
            .order_by(Sale.sale_date.desc())
            .limit(recent_limit)
        )
        recent_sales_result = await db.execute(recent_sales_query)
        recent_sales = list(recent_sales_result.scalars().all())

        recent_transactions = []
        for sale in recent_sales:
            item_count = len(sale.items) if sale.items else 0
            recent_transactions.append({
                "id": sale.id,
                "invoice_number": sale.invoice_number,
                "sale_date": sale.sale_date,
                "sales_channel": sale.sales_channel.value if hasattr(sale.sales_channel, "value") else str(sale.sales_channel),
                "payment_method": sale.payment_method.value if hasattr(sale.payment_method, "value") else str(sale.payment_method),
                "total_amount": float(sale.total_amount),
                "status": sale.status.value if hasattr(sale.status, "value") else str(sale.status),
                "item_count": item_count,
            })

        return {
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "total_quantity_purchased": total_quantity_purchased,
            "average_order_value": avg_order_value,
            "first_purchase_date": first_purchase_date,
            "last_purchase_date": last_purchase_date,
            "frequently_purchased_products": frequently_purchased_products,
            "recent_transactions": recent_transactions,
        }

    async def get_customer_lifetime_value(self, db: AsyncSession, customer_id: UUID) -> dict:
        result = await db.execute(
            select(
                func.count(Sale.id).label("total_orders"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_revenue"),
                func.avg(Sale.total_amount).label("avg_order_value"),
                func.min(Sale.sale_date).label("first_purchase"),
                func.max(Sale.sale_date).label("last_purchase"),
            )
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        row = result.one_or_none()
        return {
            "total_orders": int(row.total_orders) if row else 0,
            "total_revenue": float(row.total_revenue) if row else 0.0,
            "avg_order_value": float(row.avg_order_value) if row and row.avg_order_value else 0.0,
            "first_purchase": row.first_purchase if row else None,
            "last_purchase": row.last_purchase if row else None,
        }

    async def get_detailed_profile(self, db: AsyncSession, customer_id: UUID) -> dict:
        cust = await self.get(db, customer_id)
        if not cust:
            return None

        totals_result = await db.execute(
            select(
                func.count(Sale.id).label("total_orders"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_revenue"),
                func.avg(Sale.total_amount).label("average_order_value"),
                func.min(Sale.sale_date).label("first_purchase_date"),
                func.max(Sale.sale_date).label("last_purchase_date"),
            )
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        totals_row = totals_result.one_or_none()
        total_orders = int(totals_row.total_orders) if totals_row else 0
        total_revenue = float(totals_row.total_revenue) if totals_row else 0.0
        avg_order_value = float(totals_row.average_order_value) if totals_row and totals_row.average_order_value else 0.0
        first_purchase_date = totals_row.first_purchase_date if totals_row else None
        last_purchase_date = totals_row.last_purchase_date if totals_row else None

        purchase_frequency = 0.0
        if first_purchase_date and total_orders > 0:
            days_since_first = (datetime.utcnow() - first_purchase_date).days
            months = max(days_since_first / 30.0, 1)
            purchase_frequency = round(total_orders / months, 2)

        favourite_category_result = await db.execute(
            select(
                SaleItem.category_id.label("category_id"),
                func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(SaleItem.category_id.is_not(None))
            .group_by(SaleItem.category_id)
            .order_by(func.sum(SaleItem.total).desc())
            .limit(1)
        )
        favourite_category_row = favourite_category_result.one_or_none()
        favourite_category = None
        if favourite_category_row:
            cat = await db.execute(select(Category.id, Category.name).where(Category.id == favourite_category_row.category_id))
            cat_row = cat.one_or_none()
            if cat_row:
                favourite_category = {"id": str(cat_row.id), "name": cat_row.name}

        favourite_product_result = await db.execute(
            select(
                SaleItem.product_id.label("product_id"),
                func.coalesce(func.sum(SaleItem.total), 0).label("revenue"),
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.customer_id == customer_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(SaleItem.product_id.is_not(None))
            .group_by(SaleItem.product_id)
            .order_by(func.sum(SaleItem.total).desc())
            .limit(1)
        )
        favourite_product_row = favourite_product_result.one_or_none()
        favourite_product = None
        if favourite_product_row:
            prod = await db.execute(select(Product.id, Product.name, Product.sku).where(Product.id == favourite_product_row.product_id))
            prod_row = prod.one_or_none()
            if prod_row:
                favourite_product = {"id": str(prod_row.id), "name": prod_row.name, "sku": prod_row.sku}

        recent_sales_result = await db.execute(
            select(Sale)
            .options(selectinload(Sale.items))
            .where(Sale.customer_id == customer_id)
            .order_by(Sale.sale_date.desc())
            .limit(10)
        )
        recent_sales = list(recent_sales_result.scalars().all())
        recent_activity = []
        for sale in recent_sales:
            item_count = len(sale.items) if sale.items else 0
            recent_activity.append({
                "id": sale.id,
                "invoice_number": sale.invoice_number,
                "sale_date": sale.sale_date,
                "sales_channel": sale.sales_channel.value if hasattr(sale.sales_channel, "value") else str(sale.sales_channel),
                "payment_method": sale.payment_method.value if hasattr(sale.payment_method, "value") else str(sale.payment_method),
                "total_amount": float(sale.total_amount),
                "status": sale.status.value if hasattr(sale.status, "value") else str(sale.status),
                "item_count": item_count,
            })

        return {
            "id": cust.id,
            "company_id": cust.company_id,
            "first_name": cust.first_name,
            "last_name": cust.last_name,
            "email": cust.email,
            "phone": cust.phone,
            "date_of_birth": cust.date_of_birth,
            "gender": cust.gender,
            "address": cust.address,
            "city": cust.city,
            "state": cust.state,
            "country": cust.country,
            "postal_code": cust.postal_code,
            "customer_type": cust.customer_type.value if hasattr(cust.customer_type, "value") else str(cust.customer_type),
            "preferred_sales_channel": cust.preferred_sales_channel,
            "notes": cust.notes,
            "status": cust.status.value if hasattr(cust.status, "value") else str(cust.status),
            "customer_since": cust.customer_since,
            "created_at": cust.created_at,
            "updated_at": cust.updated_at,
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "average_order_value": avg_order_value,
            "first_purchase_date": first_purchase_date,
            "last_purchase_date": last_purchase_date,
            "purchase_frequency": purchase_frequency,
            "favourite_category": favourite_category,
            "favourite_product": favourite_product,
            "recent_activity": recent_activity,
            "segment": await self.get_segment(db, cust.id),
        }

    async def get_customer_analytics_dashboard(self, db: AsyncSession, company_id: UUID) -> dict:
        total_customers_result = await db.execute(
            select(func.count(Customer.id)).where(Customer.company_id == company_id)
        )
        total_customers = total_customers_result.scalar() or 0

        active_customers_result = await db.execute(
            select(func.count(Customer.id)).where(Customer.company_id == company_id).where(Customer.status == CustomerStatus.ACTIVE)
        )
        active_customers = active_customers_result.scalar() or 0

        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_customers_result = await db.execute(
            select(func.count(Customer.id)).where(Customer.company_id == company_id).where(Customer.customer_since >= month_start)
        )
        new_customers = new_customers_result.scalar() or 0

        returning_customers_result = await db.execute(
            select(func.count(func.distinct(Sale.customer_id)))
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
        )
        returning_customers = returning_customers_result.scalar() or 0

        revenue_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total_amount), 0))
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
        )
        total_revenue = float(revenue_result.scalar() or 0)

        avg_spend = total_revenue / active_customers if active_customers > 0 else 0.0

        purchase_frequency_query = (
            select(
                func.count(Sale.id).label("total_orders"),
                func.count(func.distinct(Sale.customer_id)).label("unique_customers"),
            )
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
        )
        purchase_frequency_result = await db.execute(purchase_frequency_query)
        pf_row = purchase_frequency_result.one_or_none()
        avg_purchase_frequency = (pf_row.total_orders / pf_row.unique_customers) if pf_row and pf_row.unique_customers > 0 else 0.0

        return {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "new_customers": new_customers,
            "returning_customers": returning_customers,
            "average_customer_spend": avg_spend,
            "total_revenue": total_revenue,
            "average_purchase_frequency": avg_purchase_frequency,
        }

    async def get_customer_growth(self, db: AsyncSession, company_id: UUID, months: int = 12) -> list[dict]:
        results = []
        now = datetime.utcnow()
        for i in range(months - 1, -1, -1):
            month_start = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - __import__('datetime').timedelta(days=30*i)).replace(day=1)
            if i == 0:
                month_end = now
            else:
                month_end = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - __import__('datetime').timedelta(days=30*(i-1))).replace(day=1) - __import__('datetime').timedelta(seconds=1)
            count_result = await db.execute(
                select(func.count(Customer.id)).where(Customer.company_id == company_id).where(Customer.customer_since >= month_start).where(Customer.customer_since <= month_end)
            )
            results.append({
                "month": month_start.strftime("%Y-%m"),
                "new_customers": count_result.scalar() or 0,
            })
        return results

    async def get_revenue_by_customer_type(self, db: AsyncSession, company_id: UUID) -> list[dict]:
        query = (
            select(
                Customer.customer_type,
                func.coalesce(func.sum(Sale.total_amount), 0).label("revenue"),
            )
            .join(Sale, Sale.customer_id == Customer.id)
            .where(Customer.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .group_by(Customer.customer_type)
        )
        result = await db.execute(query)
        rows = result.all()
        return [
            {
                "customer_type": row.customer_type.value if hasattr(row.customer_type, "value") else str(row.customer_type),
                "revenue": float(row.revenue or 0),
            }
            for row in rows
        ]

    async def get_location_distribution(self, db: AsyncSession, company_id: UUID) -> list[dict]:
        query = (
            select(Customer.state, func.count(Customer.id).label("count"))
            .where(Customer.company_id == company_id)
            .where(Customer.state.is_not(None))
            .where(Customer.state != "")
            .group_by(Customer.state)
            .order_by(func.count(Customer.id).desc())
        )
        result = await db.execute(query)
        rows = result.all()
        total = sum((row.count for row in rows), 0)
        return [
            {
                "state": row.state,
                "count": int(row.count),
                "percentage": round((row.count / total) * 100, 1) if total > 0 else 0.0,
            }
            for row in rows
        ]

    async def get_spending_distribution(self, db: AsyncSession, company_id: UUID) -> dict:
        customer_spending_query = (
            select(
                Sale.customer_id.label("customer_id"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_spent"),
            )
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
        )
        result = await db.execute(customer_spending_query)
        rows = result.all()

        buckets = {"0-100": 0, "101-500": 0, "501-1000": 0, "1001-5000": 0, "5000+": 0}
        for row in rows:
            spent = float(row.total_spent or 0)
            if spent <= 100:
                buckets["0-100"] += 1
            elif spent <= 500:
                buckets["101-500"] += 1
            elif spent <= 1000:
                buckets["501-1000"] += 1
            elif spent <= 5000:
                buckets["1001-5000"] += 1
            else:
                buckets["5000+"] += 1

        return {"buckets": buckets, "total_customers": len(rows)}

    async def get_purchase_frequency_distribution(self, db: AsyncSession, company_id: UUID) -> list[dict]:
        customer_orders_query = (
            select(
                Sale.customer_id.label("customer_id"),
                func.count(Sale.id).label("order_count"),
            )
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
        )
        result = await db.execute(customer_orders_query)
        rows = result.all()

        buckets = {"1": 0, "2-3": 0, "4-6": 0, "7-10": 0, "10+": 0}
        for row in rows:
            count = int(row.order_count)
            if count == 1:
                buckets["1"] += 1
            elif count <= 3:
                buckets["2-3"] += 1
            elif count <= 6:
                buckets["4-6"] += 1
            elif count <= 10:
                buckets["7-10"] += 1
            else:
                buckets["10+"] += 1

        return [{"range": k, "customers": v} for k, v in buckets.items()]

    async def get_segmentation(self, db: AsyncSession, company_id: UUID) -> dict:
        customer_metrics_query = (
            select(
                Sale.customer_id.label("customer_id"),
                func.count(Sale.id).label("total_orders"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_spent"),
                func.min(Sale.sale_date).label("first_purchase"),
                func.max(Sale.sale_date).label("last_purchase"),
            )
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
        )
        result = await db.execute(customer_metrics_query)
        rows = result.all()

        segments = {"NEW": 0, "REGULAR": 0, "LOYAL": 0, "VIP": 0}
        now = datetime.utcnow()

        for row in rows:
            orders = int(row.total_orders)
            spent = float(row.total_spent or 0)
            first = row.first_purchase
            days_since_first = (now - first).days if first else 9999

            if orders >= 10 and spent >= 5000:
                segments["VIP"] += 1
            elif orders >= 5 and spent >= 1000:
                segments["LOYAL"] += 1
            elif orders >= 2:
                segments["REGULAR"] += 1
            else:
                segments["NEW"] += 1

        return {"segments": segments, "total_segmented": len(rows)}

    async def get_monthly_acquisition(self, db: AsyncSession, company_id: UUID, months: int = 12) -> list[dict]:
        results = []
        now = datetime.utcnow()
        for i in range(months - 1, -1, -1):
            month_start = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - __import__('datetime').timedelta(days=30*i)).replace(day=1)
            if i == 0:
                month_end = now
            else:
                month_end = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - __import__('datetime').timedelta(days=30*(i-1))).replace(day=1) - __import__('datetime').timedelta(seconds=1)
            count_result = await db.execute(
                select(func.count(Customer.id)).where(Customer.company_id == company_id).where(Customer.customer_since >= month_start).where(Customer.customer_since <= month_end)
            )
            results.append({
                "month": month_start.strftime("%Y-%m"),
                "new_customers": count_result.scalar() or 0,
            })
        return results

    async def log_timeline(self, db: AsyncSession, company_id: UUID, customer_id: UUID, user_id: UUID | None, action: str, details: str | None = None, timestamp: datetime | None = None) -> None:
        from app.crud.customer_timeline import customer_timeline
        await customer_timeline.create(db, company_id, customer_id, user_id, action, details, timestamp)

    async def get_recent_customers(self, db: AsyncSession, company_id: UUID, limit: int = 10) -> list[dict]:
        query = (
            select(Customer)
            .where(Customer.company_id == company_id)
            .order_by(Customer.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        customers = list(result.scalars().all())
        output = []
        for cust in customers:
            summary = await self.get_purchase_summary(db, cust.id)
            output.append({
                "id": cust.id,
                "first_name": cust.first_name,
                "last_name": cust.last_name,
                "email": cust.email,
                "phone": cust.phone,
                "customer_type": cust.customer_type.value if hasattr(cust.customer_type, "value") else str(cust.customer_type),
                "status": cust.status.value if hasattr(cust.status, "value") else str(cust.status),
                "total_purchases": summary["total_purchases"],
                "total_spent": summary["total_spent"],
                "last_purchase_date": summary["last_purchase_date"],
                "customer_since": cust.customer_since,
                "created_at": cust.created_at,
            })
        return output

    async def get_customer_revenue_contribution(self, db: AsyncSession, company_id: UUID, limit: int = 10) -> list[dict]:
        query = (
            select(
                Sale.customer_id.label("customer_id"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("revenue"),
            )
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
            .order_by(func.sum(Sale.total_amount).desc())
            .limit(limit)
        )
        result = await db.execute(query)
        rows = result.all()
        customer_ids = [row.customer_id for row in rows]

        customers = {}
        if customer_ids:
            customers_result = await db.execute(select(Customer).where(Customer.id.in_(customer_ids)))
            for c in customers_result.scalars().all():
                customers[c.id] = c

        return [
            {
                "id": row.customer_id,
                "first_name": customers[row.customer_id].first_name if row.customer_id in customers else "",
                "last_name": customers[row.customer_id].last_name if row.customer_id in customers else "",
                "email": customers[row.customer_id].email if row.customer_id in customers else None,
                "revenue": float(row.revenue or 0),
            }
            for row in rows
        ]

    async def export_customers(self, db: AsyncSession, company_id: UUID, status: CustomerStatus | None = None, customer_type: CustomerType | None = None) -> list[dict]:
        customers, _ = await self.list(db, company_id, skip=0, limit=500, status=status, customer_type=customer_type)
        output = []
        for cust in customers:
            summary = await self.get_purchase_summary(db, cust.id)
            output.append({
                "id": str(cust.id),
                "first_name": cust.first_name,
                "last_name": cust.last_name,
                "email": cust.email or "",
                "phone": cust.phone or "",
                "address": cust.address or "",
                "city": cust.city or "",
                "state": cust.state or "",
                "country": cust.country or "",
                "customer_type": cust.customer_type.value if hasattr(cust.customer_type, "value") else str(cust.customer_type),
                "status": cust.status.value if hasattr(cust.status, "value") else str(cust.status),
                "customer_since": cust.customer_since.isoformat() if cust.customer_since else "",
                "total_purchases": summary["total_purchases"],
                "total_spent": float(summary["total_spent"]),
                "last_purchase_date": summary["last_purchase_date"].isoformat() if summary["last_purchase_date"] else "",
            })
        return output


customer = CRUDCustomer()
