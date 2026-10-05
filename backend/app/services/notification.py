from datetime import datetime, timedelta
from uuid import UUID
from app.models.notification import NotificationType, NotificationPriority, NotificationResourceType
from app.models.product import Product
from app.models.import_history import ImportHistory, ImportStatus
from app.models.sale import Sale
from app.models.user import User, UserRole, UserStatus
from app.crud.notification import notification as notification_crud
from app.services.audit import audit_service
from fastapi import Request
from sqlalchemy import select, func
from app.models.sale import SaleItem
from app.models.sale import SaleStatus


class NotificationService:
    STOCKOUT_RISK_DAYS_THRESHOLD = 3
    OVERSTOCK_MULTIPLIER = 3.0
    DEDUP_TTL_HOURS = 24

    NOTIFICATION_TYPE_ROLES: dict[NotificationType, list[UserRole]] = {
        NotificationType.STOCKOUT_RISK: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ANALYST],
        NotificationType.OUT_OF_STOCK: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ANALYST],
        NotificationType.LOW_STOCK: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ANALYST],
        NotificationType.OVERSTOCK: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ANALYST],
        NotificationType.IMPORT_FAILED: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
        NotificationType.IMPORT_COMPLETED: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
        NotificationType.IMPORT_COMPLETED_WITH_ERRORS: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
        NotificationType.SYSTEM_ALERT: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
        NotificationType.SALES_ALERT: [UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN],
        NotificationType.CUSTOMER_REGISTERED: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
        NotificationType.VIP_STATUS: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
        NotificationType.CUSTOMER_INACTIVE: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
        NotificationType.FIRST_PURCHASE: [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN],
    }

    def _ttl(self) -> datetime:
        return datetime.utcnow() + timedelta(hours=self.DEDUP_TTL_HOURS)

    def _priority_for_stock(self, available: int, threshold: int) -> NotificationPriority:
        if available == 0:
            return NotificationPriority.CRITICAL
        if available <= threshold:
            return NotificationPriority.HIGH
        return NotificationPriority.MEDIUM

    async def _get_avg_daily_sales(self, db, company_id: UUID, product_id: UUID) -> float:
        sales_cutoff = datetime.utcnow() - timedelta(days=90)
        result = await db.execute(
            select(func.sum(SaleItem.quantity))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(SaleItem.product_id == product_id)
            .where(Sale.sale_date >= sales_cutoff)
            .where(Sale.status == SaleStatus.COMPLETED)
        )
        total_qty = result.scalar() or 0
        return round(total_qty / 90, 2)

    async def _get_target_user_ids(self, db, company_id: UUID, notif_type: NotificationType) -> list[UUID]:
        target_roles = self.NOTIFICATION_TYPE_ROLES.get(notif_type, [])
        if not target_roles:
            return []
        result = await db.execute(
            select(User.id).where(
                User.company_id == company_id,
                User.role.in_(target_roles),
                User.status == UserStatus.ACTIVE,
            )
        )
        return [row[0] for row in result.all()]

    async def _create_alert_for_roles(self, db, company_id: UUID, notif_type: NotificationType, priority: NotificationPriority, title: str, message: str, resource_type: NotificationResourceType, resource_id: UUID, request: Request | None, user_id: UUID | None = None) -> None:
        target_user_ids = await self._get_target_user_ids(db, company_id, notif_type)
        for uid in target_user_ids:
            await self._create_alert(
                db, company_id, notif_type, priority, title, message,
                resource_type, resource_id, self._ttl(), request, uid
            )

    async def evaluate_inventory_alerts(self, db, company_id: UUID, product: Product, request: Request | None = None, user_id: UUID | None = None) -> None:
        available = max((product.stock_quantity or 0) - (product.reserved_stock or 0), 0)
        threshold = product.low_stock_threshold or 5
        ttl = self._ttl()

        if available == 0:
            await self._create_alert_for_roles(
                db, company_id, NotificationType.OUT_OF_STOCK, NotificationPriority.CRITICAL,
                f"Out of Stock: {product.name}",
                f"Product '{product.name}' (SKU: {product.sku}) has reached 0 stock. Reorder Point: {threshold}. Immediate restocking is required.",
                NotificationResourceType.PRODUCT, product.id, request, user_id,
            )
            await notification_crud.resolve_open_alerts(db, company_id, NotificationType.STOCKOUT_RISK, NotificationResourceType.PRODUCT, product.id)
            await notification_crud.resolve_open_alerts(db, company_id, NotificationType.LOW_STOCK, NotificationResourceType.PRODUCT, product.id)
            await notification_crud.resolve_open_alerts(db, company_id, NotificationType.OVERSTOCK, NotificationResourceType.PRODUCT, product.id)
            return

        if available <= threshold:
            avg_daily_sales = await self._get_avg_daily_sales(db, company_id, product.id)
            days_remaining = (available / avg_daily_sales) if avg_daily_sales > 0 else None

            if days_remaining is not None and days_remaining <= self.STOCKOUT_RISK_DAYS_THRESHOLD:
                await self._create_alert_for_roles(
                    db, company_id, NotificationType.STOCKOUT_RISK, NotificationPriority.HIGH,
                    f"Stockout Risk: {product.name}",
                    f"Product '{product.name}' (SKU: {product.sku}) is expected to reach stockout within {days_remaining:.1f} days. Current Stock: {available}, Reorder Point: {threshold}.",
                    NotificationResourceType.PRODUCT, product.id, request, user_id,
                )
                await notification_crud.resolve_open_alerts(db, company_id, NotificationType.LOW_STOCK, NotificationResourceType.PRODUCT, product.id)
                await notification_crud.resolve_open_alerts(db, company_id, NotificationType.OVERSTOCK, NotificationResourceType.PRODUCT, product.id)
                return

            await self._create_alert_for_roles(
                db, company_id, NotificationType.LOW_STOCK, NotificationPriority.HIGH,
                f"Low Stock: {product.name}",
                f"Product '{product.name}' (SKU: {product.sku}) has fallen below the reorder point. Available: {available}, Reorder Point: {threshold}.",
                NotificationResourceType.PRODUCT, product.id, request, user_id,
            )
            await notification_crud.resolve_open_alerts(db, company_id, NotificationType.STOCKOUT_RISK, NotificationResourceType.PRODUCT, product.id)
            await notification_crud.resolve_open_alerts(db, company_id, NotificationType.OVERSTOCK, NotificationResourceType.PRODUCT, product.id)
            return

        avg_daily_sales = await self._get_avg_daily_sales(db, company_id, product.id)
        if avg_daily_sales > 0 and available > threshold * self.OVERSTOCK_MULTIPLIER:
            days_of_stock = available / avg_daily_sales
            if days_of_stock > 60:
                await self._create_alert_for_roles(
                    db, company_id, NotificationType.OVERSTOCK, NotificationPriority.LOW,
                    f"Overstock: {product.name}",
                    f"Product '{product.name}' (SKU: {product.sku}) appears overstocked. Current Stock: {available}, Reorder Point: {threshold}. ~{days_of_stock:.0f} days of stock remaining.",
                    NotificationResourceType.PRODUCT, product.id, request, user_id,
                )
                return

        await notification_crud.resolve_open_alerts(db, company_id, NotificationType.LOW_STOCK, NotificationResourceType.PRODUCT, product.id)
        await notification_crud.resolve_open_alerts(db, company_id, NotificationType.STOCKOUT_RISK, NotificationResourceType.PRODUCT, product.id)
        await notification_crud.resolve_open_alerts(db, company_id, NotificationType.OUT_OF_STOCK, NotificationResourceType.PRODUCT, product.id)
        await notification_crud.resolve_open_alerts(db, company_id, NotificationType.OVERSTOCK, NotificationResourceType.PRODUCT, product.id)

    async def _create_alert(self, db, company_id: UUID, notif_type: NotificationType, priority: NotificationPriority, title: str, message: str, resource_type: NotificationResourceType, resource_id: UUID, expires_at: datetime, request: Request | None, user_id: UUID | None) -> None:
        await notification_crud.create(
            db=db,
            company_id=company_id,
            title=title,
            message=message,
            type=notif_type,
            priority=priority,
            resource_type=resource_type,
            resource_id=resource_id,
            expires_at=expires_at,
            user_id=user_id,
        )
        if request and user_id:
            await audit_service.log(
                db, company_id, user_id, f"Notification Created: {notif_type.value}",
                request, resource_type=resource_type.value, resource_id=resource_id,
                description=message,
            )

    async def on_import_completed(self, db, company_id: UUID, import_history: ImportHistory, request: Request, user_id: UUID | None = None) -> None:
        status = import_history.status
        if status == ImportStatus.COMPLETED:
            notif_type = NotificationType.IMPORT_COMPLETED
            priority = NotificationPriority.LOW
            title = f"Import Completed: {import_history.filename}"
            message = (
                f"Import of '{import_history.filename}' ({import_history.import_type.value}) completed successfully. "
                f"Total: {import_history.total_records}, Successful: {import_history.successful_records}."
            )
        elif status == ImportStatus.COMPLETED_WITH_ERRORS:
            notif_type = NotificationType.IMPORT_COMPLETED_WITH_ERRORS
            priority = NotificationPriority.MEDIUM
            title = f"Import Completed with Errors: {import_history.filename}"
            message = (
                f"Import of '{import_history.filename}' ({import_history.import_type.value}) completed with errors. "
                f"Total: {import_history.total_records}, Successful: {import_history.successful_records}, "
                f"Failed: {import_history.failed_records}, Duplicates: {import_history.duplicate_records}."
            )
        else:
            notif_type = NotificationType.IMPORT_FAILED
            priority = NotificationPriority.HIGH
            title = f"Import Failed: {import_history.filename}"
            message = (
                f"Import of '{import_history.filename}' ({import_history.import_type.value}) failed. "
                f"Total: {import_history.total_records}, Failed: {import_history.failed_records}."
            )

        await self._create_alert_for_roles(
            db, company_id, notif_type, priority, title, message,
            NotificationResourceType.IMPORT, import_history.id, request, user_id,
        )
        await audit_service.log(
            db, company_id, user_id, f"Notification Created: {notif_type.value}",
            request, resource_type="Import", resource_id=import_history.id,
            description=message,
        )

    async def on_sale_completed(self, db, company_id: UUID, sale: Sale, request: Request, user_id: UUID | None = None) -> None:
        total = sale.total_amount or 0
        priority = NotificationPriority.HIGH if total > 10000 else NotificationPriority.LOW
        title = f"New Sale: {sale.invoice_number}"
        message = f"Sale {sale.invoice_number} completed for {total:.2f}. Customer: {sale.customer_name}."
        await self._create_alert_for_roles(
            db, company_id, NotificationType.SALES_ALERT, priority, title, message,
            NotificationResourceType.SALE, sale.id, request, user_id,
        )
        await audit_service.log(
            db, company_id, user_id, "Notification Created: SALES_ALERT",
            request, resource_type="Sale", resource_id=sale.id, description=message,
        )

    async def run_bulk_evaluation(self, db, company_id: UUID, request: Request | None = None, user_id: UUID | None = None) -> dict:
        from app.models.product import Product
        from sqlalchemy import select

        result = await db.execute(
            select(Product).where(Product.company_id == company_id, Product.status == "ACTIVE")
        )
        products = result.scalars().all()

        evaluated = 0
        for product in products:
            await self.evaluate_inventory_alerts(db, company_id, product, request, user_id)
            evaluated += 1

        await db.commit()
        return {"evaluated": evaluated}


from sqlalchemy import func  # noqa: E402
from app.models.sale import SaleStatus  # noqa: E402

notification_service = NotificationService()
