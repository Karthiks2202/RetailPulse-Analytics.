from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.product import Product, ProductStatus
from app.models.category import Category
from app.models.audit_log import AuditLog
from app.models.notification import Notification, NotificationType
from app.models.inventory import StockMovement, MovementType
from app.models.customer import Customer
from app.models.customer_timeline import CustomerTimeline
from app.crud.audit_log import audit_log as audit_log_crud
from fastapi import Request
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import Optional


class CRUDSale:
    async def _log_audit(self, db, company_id, user_id, action, request, entity_name="", details=None):
        from app.services.audit import audit_service
        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown")
        browser = request.headers.get("user-agent", "Unknown")
        await audit_log_crud.create(db, company_id=company_id, user_id=user_id, action=action, entity_name=entity_name, details=details, ip_address=ip_address, browser=browser)

    async def get_invoice_number(self, db: AsyncSession, company_id: UUID) -> str:
        year = datetime.utcnow().year
        prefix = f"INV-{year}-"
        result = await db.execute(select(func.nextval('invoice_seq')))
        next_seq = result.scalar_one()
        return f"{prefix}{next_seq:06d}"

    async def get(self, db: AsyncSession, sale_id: UUID) -> Sale | None:
        result = await db.execute(select(Sale).where(Sale.id == sale_id).options(selectinload(Sale.items)))
        return result.scalar_one_or_none()

    async def get_by_invoice(self, db: AsyncSession, company_id: UUID, invoice_number: str) -> Sale | None:
        result = await db.execute(
            select(Sale).where(Sale.company_id == company_id).where(Sale.invoice_number == invoice_number)
        )
        return result.scalar_one_or_none()

    async def _build_sale_query(
        self,
        company_id: UUID,
        search: str | None = None,
        customer_name: str | None = None,
        product_name: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        sales_channel: str | None = None,
        payment_method: str | None = None,
        payment_status: str | None = None,
        category_id: UUID | None = None,
    ):
        query = select(Sale).where(Sale.company_id == company_id).options(selectinload(Sale.items))

        if search:
            query = (
                query.outerjoin(SaleItem, Sale.id == SaleItem.sale_id)
                .outerjoin(Product, SaleItem.product_id == Product.id)
                .where(
                    Sale.invoice_number.ilike(f"%{search}%")
                    | Sale.customer_name.ilike(f"%{search}%")
                    | Product.name.ilike(f"%{search}%")
                )
                .distinct()
            )

        if customer_name:
            query = query.where(Sale.customer_name.ilike(f"%{customer_name}%"))

        if date_from:
            query = query.where(Sale.sale_date >= date_from)

        if date_to:
            query = query.where(Sale.sale_date <= date_to)

        if sales_channel:
            query = query.where(Sale.sales_channel == sales_channel)

        if payment_method:
            query = query.where(Sale.payment_method == payment_method)

        if payment_status:
            query = query.where(Sale.payment_status == payment_status)

        if category_id:
            query = query.join(SaleItem).where(SaleItem.category_id == category_id).distinct()

        if product_name:
            query = query.join(SaleItem).join(Product).where(Product.name.ilike(f"%{product_name}%")).distinct()

        return query

    async def list(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
        customer_name: str | None = None,
        product_name: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        sales_channel: str | None = None,
        payment_method: str | None = None,
        payment_status: str | None = None,
        category_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[Sale], int]:
        query = self._build_sale_query(
            company_id, search, customer_name, product_name, date_from, date_to,
            sales_channel, payment_method, payment_status, category_id,
        )

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        sort_column = getattr(Sale, sort_by, Sale.created_at)
        if sort_dir == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all()), total

    async def list_with_items(
        self,
        db: AsyncSession,
        company_id: UUID,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
        customer_name: str | None = None,
        product_name: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        sales_channel: str | None = None,
        payment_method: str | None = None,
        payment_status: str | None = None,
        category_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[Sale], int]:
        query = self._build_sale_query(
            company_id, search, customer_name, product_name, date_from, date_to,
            sales_channel, payment_method, payment_status, category_id,
        )

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        sort_column = getattr(Sale, sort_by, Sale.created_at)
        if sort_dir == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        sales = list(result.scalars().all())
        return sales, total

    async def create(self, db: AsyncSession, company_id: UUID, user_id: UUID, customer_name: Optional[str], sale_date: datetime, sales_channel: str, payment_method: str, items: list, request: Request, customer_id: Optional[UUID] = None, notes: Optional[str] = None) -> Sale:
        # Auto-link customer by name if customer_id not provided
        if not customer_id and customer_name:
            from sqlalchemy import func as sa_func
            name_parts = customer_name.strip().split()
            if len(name_parts) >= 2:
                first_name = name_parts[0]
                last_name = " ".join(name_parts[1:])
                res = await db.execute(
                    select(Customer)
                    .where(Customer.company_id == company_id)
                    .where(sa_func.lower(Customer.first_name) == first_name.lower())
                    .where(sa_func.lower(Customer.last_name) == last_name.lower())
                    .where(Customer.is_deleted == False)
                )
            else:
                res = await db.execute(
                    select(Customer)
                    .where(Customer.company_id == company_id)
                    .where(sa_func.lower(Customer.first_name) == customer_name.strip().lower())
                    .where(Customer.is_deleted == False)
                )
            matched = res.scalar_one_or_none()
            if matched:
                customer_id = matched.id

        if customer_id:
            customer = await db.get(Customer, customer_id)
            if not customer or customer.company_id != company_id:
                raise ValueError("Customer not found")

        total_amount = Decimal("0")
        sale_items = []
        product_updates = []
        initial_quantities: dict[UUID, int] = {}
        stock_movements = []
        notifications = []
        audit_entries = []

        for item_data in items:
            product_id = item_data.get("product_id")
            quantity = item_data.get("quantity")
            unit_price = Decimal(str(item_data.get("unit_price", 0)))
            discount = Decimal(str(item_data.get("discount", 0)))
            tax = Decimal(str(item_data.get("tax", 0)))

            product = None
            category_id = None
            if product_id:
                product = await db.get(Product, product_id)
                if not product or product.company_id != company_id:
                    raise ValueError("Invalid product selected")
                if product.status == ProductStatus.INACTIVE:
                    raise ValueError(f"Product {product.name} is inactive")
                available = product.stock_quantity - product.reserved_stock
                if quantity > available:
                    raise ValueError(f"Insufficient available stock for {product.name}. Available: {available}, Requested: {quantity}")
                if unit_price < 0:
                    raise ValueError("Unit price cannot be negative")
                if discount < 0:
                    raise ValueError("Discount cannot be negative")
                gross_amount = unit_price * quantity
                if discount > gross_amount:
                    raise ValueError("Discount cannot exceed total product value")
                if tax < 0:
                    raise ValueError("Tax cannot be negative")

                initial_quantities[product.id] = product.stock_quantity
                category_id = product.category_id
                product.stock_quantity -= quantity

                if product.stock_quantity < 0:
                    product.stock_quantity = 0

                if product.stock_quantity == 0:
                    audit_entries.append(AuditLog(
                        company_id=company_id, user_id=user_id, action="Product Out of Stock",
                        entity_name=product.name, details=f"Product '{product.name}' stock reached 0",
                        ip_address=request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown"),
                        browser=request.headers.get("user-agent", "Unknown"),
                    ))
                    notifications.append(Notification(
                        company_id=company_id, user_id=user_id,
                        title="Out of Stock", message=f"Product '{product.name}' is out of stock.",
                        type=NotificationType.OUT_OF_STOCK,
                    ))
                elif product.stock_quantity <= product.low_stock_threshold:
                    audit_entries.append(AuditLog(
                        company_id=company_id, user_id=user_id, action="Low Stock Alert",
                        entity_name=product.name, details=f"Product '{product.name}' stock is low: {product.stock_quantity}",
                        ip_address=request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown"),
                        browser=request.headers.get("user-agent", "Unknown"),
                    ))
                    notifications.append(Notification(
                        company_id=company_id, user_id=user_id,
                        title="Low Stock", message=f"Product '{product.name}' stock is low: {product.stock_quantity}.",
                        type=NotificationType.LOW_STOCK,
                    ))

                product_updates.append(product)

            item_total = (unit_price * quantity) - discount + tax
            total_amount += item_total

            sale_items.append(SaleItem(
                product_id=product_id, category_id=category_id, quantity=quantity,
                unit_price=float(unit_price), discount=float(discount), tax=float(tax), total=float(item_total),
            ))

        for attempt in range(3):
            invoice_number = await self.get_invoice_number(db, company_id)
            sale = Sale(
                company_id=company_id, invoice_number=invoice_number, customer_id=customer_id,
                customer_name=customer_name, sale_date=sale_date, sales_channel=sales_channel,
                payment_method=payment_method, total_amount=float(total_amount),
                created_by=user_id, notes=notes, items=sale_items,
            )
            try:
                db.add(sale)
                for p in product_updates:
                    db.add(p)
                ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown")
                browser = request.headers.get("user-agent", "Unknown")
                db.add(AuditLog(
                    company_id=company_id, user_id=user_id, action="Sale Created",
                    entity_name=invoice_number,
                    details=f"Sale {invoice_number} created with {len(sale_items)} items, total ${float(total_amount):.2f}",
                    ip_address=ip_address, browser=browser,
                ))
                for a in audit_entries:
                    db.add(a)
                for n in notifications:
                    db.add(n)

                if customer_id:
                    customer = await db.get(Customer, customer_id)
                    customer_details = f"{customer.first_name} {customer.last_name}" if customer else customer_name or "Unknown"
                    first_sale_result = await db.execute(
                        select(Sale.id).where(Sale.company_id == company_id).where(Sale.customer_id == customer_id).where(Sale.status == SaleStatus.COMPLETED).order_by(Sale.sale_date.asc()).limit(1)
                    )
                    first_sale_id = first_sale_result.scalar_one_or_none()
                    is_first = (first_sale_id == sale.id)
                    action = "First Purchase" if is_first else "New Purchase"
                    db.add(CustomerTimeline(
                        company_id=company_id, customer_id=customer_id, user_id=user_id,
                        action=action, details=f"{action} by {customer_details} - ${float(total_amount):.2f}",
                    ))
                    if is_first:
                        db.add(Notification(
                            company_id=company_id, user_id=user_id,
                            title="First Purchase",
                            message=f"Customer '{customer_details}' made their first purchase of ${float(total_amount):.2f}.",
                            type=NotificationType.FIRST_PURCHASE,
                        ))

                for product_id, initial_qty in initial_quantities.items():
                    qty = next((item.get("quantity") for item in items if item.get("product_id") == product_id), 0)
                    if qty > 0:
                        db.add(StockMovement(
                            company_id=company_id, product_id=product_id, movement_type=MovementType.SALE,
                            previous_quantity=initial_qty, updated_quantity=initial_qty - qty,
                            quantity_changed=-qty, reason=f"Sale {invoice_number}", user_id=user_id,
                        ))

                await db.commit()
                break
            except IntegrityError:
                await db.rollback()
                if attempt == 2:
                    raise

        await db.refresh(sale, attribute_names=["items"])
        for item in sale.items:
            await db.refresh(item)

        if customer_id:
            from app.crud.customer import customer as customer_crud
            await customer_crud.recalculate_segment(db, customer_id)

        return sale

    async def update(self, db: AsyncSession, sale_id: UUID, company_id: UUID, user_id: UUID, payload: dict, request: Request) -> Sale:
        sale = await self.get(db, sale_id)
        if not sale or sale.company_id != company_id:
            raise ValueError("Sale not found")

        if sale.status == SaleStatus.CANCELLED:
            raise ValueError("Cannot update a cancelled sale")

        items = payload.get("items")
        stock_movements = []
        initial_quantities: dict[UUID, int] = {}

        if items is not None:
            product_updates = []

            for old_item in sale.items:
                if old_item.product_id:
                    product = await db.get(Product, old_item.product_id)
                    if product:
                        initial_quantities[product.id] = product.stock_quantity
                        product.stock_quantity += old_item.quantity
                        if product.status == ProductStatus.INACTIVE and product.stock_quantity > 0:
                            product.status = ProductStatus.ACTIVE
                        product_updates.append(product)

            total_amount = Decimal("0")
            new_items = []
            for item_data in items:
                product_id = item_data.get("product_id")
                quantity = item_data.get("quantity")
                unit_price = Decimal(str(item_data.get("unit_price", 0)))
                discount = Decimal(str(item_data.get("discount", 0)))
                tax = Decimal(str(item_data.get("tax", 0)))

                product = None
                category_id = None
                if product_id:
                    product = await db.get(Product, product_id)
                    if not product or product.company_id != company_id:
                        raise ValueError("Invalid product selected")
                    if product.status == ProductStatus.INACTIVE:
                        raise ValueError(f"Product {product.name} is inactive")
                    available = product.stock_quantity - product.reserved_stock
                    if quantity > available:
                        raise ValueError(f"Insufficient available stock for {product.name}. Available: {available}, Requested: {quantity}")
                    if unit_price < 0:
                        raise ValueError("Unit price cannot be negative")
                    if discount < 0:
                        raise ValueError("Discount cannot be negative")
                    gross_amount = unit_price * quantity
                    if discount > gross_amount:
                        raise ValueError("Discount cannot exceed total product value")
                    if tax < 0:
                        raise ValueError("Tax cannot be negative")

                    if product.id not in initial_quantities:
                        initial_quantities[product.id] = product.stock_quantity
                    category_id = product.category_id
                    product.stock_quantity -= quantity

                    if product.stock_quantity < 0:
                        product.stock_quantity = 0

                    if product.stock_quantity == 0:
                        pass
                    elif product.stock_quantity <= product.low_stock_threshold:
                        pass

                    product_updates.append(product)

                item_total = (unit_price * quantity) - discount + tax
                total_amount += item_total

                new_items.append(SaleItem(
                    product_id=product_id, category_id=category_id, quantity=quantity,
                    unit_price=float(unit_price), discount=float(discount), tax=float(tax), total=float(item_total),
                ))

            for old_item in sale.items:
                await db.delete(old_item)

            for new_item in new_items:
                sale.items.append(new_item)

            sale.total_amount = float(total_amount)

        update_fields = ["customer_name", "sale_date", "sales_channel", "payment_method", "status", "notes"]
        for field in update_fields:
            if field in payload:
                setattr(sale, field, payload[field])

        sale.updated_at = datetime.utcnow()

        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown")
        browser = request.headers.get("user-agent", "Unknown")
        db.add(AuditLog(
            company_id=company_id, user_id=user_id, action="Sale Updated",
            entity_name=sale.invoice_number, details=f"Sale {sale.invoice_number} updated",
            ip_address=ip_address, browser=browser,
        ))

        for pid, initial_qty in initial_quantities.items():
            product = await db.get(Product, pid)
            if product:
                final_qty = product.stock_quantity
                change = final_qty - initial_qty
                if change != 0:
                    db.add(StockMovement(
                        company_id=company_id, product_id=pid,
                        movement_type=MovementType.SALE,
                        previous_quantity=initial_qty, updated_quantity=final_qty,
                        quantity_changed=change, user_id=user_id,
                        reason=f"Sale update - {sale.invoice_number}",
                    ))

        await db.commit()
        await db.refresh(sale, attribute_names=["items"])
        for item in sale.items:
            await db.refresh(item)

        if sale.customer_id:
            from app.crud.customer import customer as customer_crud
            await customer_crud.recalculate_segment(db, sale.customer_id)

        return sale

    async def delete(self, db: AsyncSession, sale_id: UUID, company_id: UUID, user_id: UUID, request: Request) -> None:
        sale = await self.get(db, sale_id)
        if not sale or sale.company_id != company_id:
            raise ValueError("Sale not found")

        await db.refresh(sale, attribute_names=["items"])
        initial_quantities = {}
        customer_id = sale.customer_id

        for item in sale.items:
            if item.product_id:
                product = await db.get(Product, item.product_id)
                if product:
                    initial_quantities[product.id] = product.stock_quantity
                    product.stock_quantity += item.quantity
                    if product.status == ProductStatus.INACTIVE and product.stock_quantity > 0:
                        product.status = ProductStatus.ACTIVE

        invoice_number = sale.invoice_number
        await db.delete(sale)

        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "Unknown")
        browser = request.headers.get("user-agent", "Unknown")
        db.add(AuditLog(
            company_id=company_id, user_id=user_id, action="Sale Deleted",
            entity_name=invoice_number, details=f"Sale {invoice_number} deleted and inventory restored",
            ip_address=ip_address, browser=browser,
        ))

        for pid, initial_qty in initial_quantities.items():
            product = await db.get(Product, pid)
            if product:
                final_qty = product.stock_quantity
                change = final_qty - initial_qty
                if change != 0:
                    db.add(StockMovement(
                        company_id=company_id, product_id=pid,
                        movement_type=MovementType.SALE,
                        previous_quantity=initial_qty, updated_quantity=final_qty,
                        quantity_changed=change, user_id=user_id,
                        reason=f"Sale {invoice_number} deleted",
                    ))

        await db.commit()

        if customer_id:
            from app.crud.customer import customer as customer_crud
            await customer_crud.recalculate_segment(db, customer_id)

    async def get_summary(self, db: AsyncSession, company_id: UUID) -> dict:
        total_sales_result = await db.execute(
            select(func.count(Sale.id)).where(Sale.company_id == company_id)
        )
        total_sales = total_sales_result.scalar() or 0

        total_revenue_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total_amount), 0)).where(Sale.company_id == company_id)
        )
        total_revenue = float(total_revenue_result.scalar() or 0)

        total_orders = total_sales

        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0.0

        return {
            "total_sales": total_sales,
            "total_revenue": total_revenue,
            "total_orders": total_orders,
            "average_order_value": avg_order_value,
        }

    async def export_sales(self, db: AsyncSession, company_id: UUID) -> list[dict]:
        result = await db.execute(
            select(Sale)
            .where(Sale.company_id == company_id)
            .options(selectinload(Sale.items).selectinload(SaleItem.product))
            .order_by(Sale.sale_date.desc())
        )
        sales = list(result.scalars().all())
        rows = []
        for sale in sales:
            for item in sale.items or []:
                rows.append({
                    "invoice_number": sale.invoice_number,
                    "sale_date": sale.sale_date.isoformat() if sale.sale_date else "",
                    "customer_name": sale.customer_name or "",
                    "payment_method": sale.payment_method.value if sale.payment_method else "",
                    "status": sale.status.value if sale.status else "",
                    "product_name": item.product.name if item.product else "",
                    "sku": item.product.sku if item.product else "",
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                    "discount": float(item.discount),
                    "tax": float(item.tax),
                    "line_total": float(item.total),
                    "total_amount": float(sale.total_amount),
                })
        return rows


sale = CRUDSale()
