from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, update, desc
from sqlalchemy.orm import selectinload
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any, Tuple
import asyncio

from app.models.data_quality import (
    DataQualityIssue,
    ReconciliationRun,
    DataQualityIssueType,
    DataQualityIssueSeverity,
    DataQualityIssueStatus,
    ReconciliationStatus,
)
from app.models.sale import Sale, SaleItem, SaleStatus
from app.models.product import Product, ProductStatus
from app.models.customer import Customer, CustomerStatus
from app.models.inventory import StockMovement, MovementType, InventoryAdjustment, AdjustmentType
from app.schemas.data_quality import ReconciliationRunCreate, DataQualityIssueCreate
from app.crud import data_quality_issue_crud as dq_issue_crud, reconciliation_run_crud as dq_run_crud
from app.crud.audit_log import audit_log as audit_log_crud
from app.services.audit import audit_service
from fastapi import Request


class DataQualityService:
    def __init__(self):
        self.checks = [
            self._check_sale_exceeds_stock,
            self._check_inventory_inconsistent_with_movements,
            self._check_sale_references_inactive_product,
            self._check_sale_references_invalid_customer,
            self._check_duplicate_product_skus,
            self._check_missing_mandatory_product_info,
            self._check_missing_mandatory_customer_info,
            self._check_stock_movement_inconsistent_quantities,
            self._check_report_total_mismatch,
        ]

    async def run_reconciliation(
        self,
        db: AsyncSession,
        company_id: UUID,
        triggered_by: UUID,
        request: Optional[Request] = None,
    ) -> Dict[str, Any]:
        run = await dq_run_crud.create(
            db,
            ReconciliationRunCreate(company_id=company_id, triggered_by=triggered_by),
        )

        try:
            await db.refresh(run)
            await db.execute(
                update(ReconciliationRun)
                .where(ReconciliationRun.id == run.id)
                .values(status=ReconciliationStatus.RUNNING, started_at=datetime.utcnow())
            )
            await db.commit()

            total_records = 0
            issues_detected = 0
            failed_checks = 0
            check_results: Dict[str, Any] = {}

            for check in self.checks:
                check_name = check.__name__.replace("_check_", "")
                try:
                    result = await check(db, company_id)
                    records_checked = result.get("records_checked", 0)
                    new_issues = result.get("new_issues", 0)
                    total_records += records_checked
                    issues_detected += new_issues
                    check_results[check_name] = {
                        "records_checked": records_checked,
                        "issues_detected": new_issues,
                        "status": "completed",
                        "details": result.get("details", {}),
                    }
                except Exception as e:
                    failed_checks += 1
                    check_results[check_name] = {
                        "records_checked": 0,
                        "issues_detected": 0,
                        "status": "failed",
                        "error": str(e),
                    }

            final_status = ReconciliationStatus.COMPLETED_WITH_ISSUES if issues_detected > 0 else ReconciliationStatus.COMPLETED

            await dq_run_crud.update(
                db,
                run.id,
                company_id,
                status=final_status,
                completed_at=datetime.utcnow(),
                records_checked=total_records,
                issues_detected=issues_detected,
                failed_checks=failed_checks,
                check_results=check_results,
            )
            await db.commit()

            if request:
                await audit_service.log(
                    db,
                    company_id,
                    triggered_by,
                    "Data Quality Reconciliation",
                    request,
                    resource_type="ReconciliationRun",
                    resource_id=run.id,
                    description=f"Reconciliation completed: {issues_detected} issues detected across {total_records} records",
                    after_values={"status": final_status.value, "issues_detected": issues_detected},
                )

            return {
                "run_id": run.id,
                "status": final_status,
                "records_checked": total_records,
                "issues_detected": issues_detected,
                "issues_resolved": 0,
                "failed_checks": failed_checks,
                "check_results": check_results,
            }

        except Exception as e:
            await dq_run_crud.update(
                db,
                run.id,
                company_id,
                status=ReconciliationStatus.FAILED,
                completed_at=datetime.utcnow(),
                error_message=str(e),
            )
            await db.commit()
            raise

    async def _create_or_update_issue(
        self,
        db: AsyncSession,
        company_id: UUID,
        issue_type: DataQualityIssueType,
        severity: DataQualityIssueSeverity,
        affected_module: str,
        affected_record_id: Optional[UUID],
        affected_record_type: Optional[str],
        description: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Create a new issue or update existing one if same unresolved problem exists. Returns True if new issue created."""
        existing = await dq_issue_crud.get_by_type_and_record(
            db, company_id, issue_type.value, affected_record_id
        ) if affected_record_id else None

        if existing:
            return False  # Already exists as unresolved

        await dq_issue_crud.create(
            db,
            DataQualityIssueCreate(
                company_id=company_id,
                issue_type=issue_type,
                severity=severity,
                status=DataQualityIssueStatus.OPEN,
                affected_module=affected_module,
                affected_record_id=affected_record_id,
                affected_record_type=affected_record_type,
                description=description,
                details=details,
            ),
        )
        return True

    async def _check_sale_exceeds_stock(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check if any sale item quantity exceeds available stock at time of sale."""
        result = await db.execute(
            select(SaleItem, Sale)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .options(selectinload(SaleItem.product))
        )
        rows = result.all()

        records_checked = len(rows)
        new_issues = 0
        details = {}

        for sale_item, sale in rows:
            product = sale_item.product
            if not product:
                continue

            available_at_sale = product.stock_quantity  # Simplified: current stock as proxy
            if sale_item.quantity > available_at_sale:
                created = await self._create_or_update_issue(
                    db,
                    company_id,
                    DataQualityIssueType.SALE_EXCEEDS_STOCK,
                    DataQualityIssueSeverity.HIGH,
                    "sales",
                    sale_item.sale_id,
                    "sale_item",
                    f"Sale item quantity {sale_item.quantity} exceeds available stock {available_at_sale} for product '{product.name}'",
                    details={
                        "sale_id": str(sale.id),
                        "sale_item_id": str(sale_item.id),
                        "product_id": str(product.id),
                        "product_name": product.name,
                        "quantity_sold": sale_item.quantity,
                        "available_stock": available_at_sale,
                        "invoice_number": sale.invoice_number,
                    },
                )
                if created:
                    new_issues += 1

        details = {"sales_checked": records_checked}
        return {"records_checked": records_checked, "new_issues": new_issues, "details": details}

    async def _check_inventory_inconsistent_with_movements(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check if product stock_quantity is inconsistent with sum of stock movements."""
        result = await db.execute(
            select(Product).where(Product.company_id == company_id)
        )
        products = result.scalars().all()

        records_checked = len(products)
        new_issues = 0

        for product in products:
            movement_result = await db.execute(
                select(func.coalesce(func.sum(StockMovement.quantity_changed), 0))
                .where(StockMovement.product_id == product.id)
                .where(StockMovement.company_id == company_id)
            )
            total_movement = int(movement_result.scalar_one() or 0)

            expected_stock = total_movement  # Movements track changes from zero
            if product.stock_quantity != expected_stock:
                await self._create_or_update_issue(
                    db,
                    company_id,
                    DataQualityIssueType.INVENTORY_INCONSISTENT_WITH_MOVEMENTS,
                    DataQualityIssueSeverity.HIGH,
                    "inventory",
                    product.id,
                    "product",
                    f"Product '{product.name}' stock_quantity ({product.stock_quantity}) inconsistent with stock movements sum ({expected_stock})",
                    details={
                        "product_id": str(product.id),
                        "product_name": product.name,
                        "current_stock": product.stock_quantity,
                        "expected_stock": expected_stock,
                        "difference": product.stock_quantity - expected_stock,
                    },
                )
                new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"products_checked": records_checked}}

    async def _check_sale_references_inactive_product(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check if any sale references an inactive product."""
        result = await db.execute(
            select(SaleItem, Sale)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(Sale.company_id == company_id)
            .where(Sale.status == SaleStatus.COMPLETED)
            .where(Product.status == ProductStatus.INACTIVE)
            .options(selectinload(SaleItem.product))
        )
        rows = result.all()

        records_checked = len(rows)
        new_issues = 0

        for sale_item, sale in rows:
            product = sale_item.product
            await self._create_or_update_issue(
                db,
                company_id,
                DataQualityIssueType.SALE_REFERENCES_INACTIVE_PRODUCT,
                DataQualityIssueSeverity.MEDIUM,
                "sales",
                sale.id,
                "sale",
                f"Sale {sale.invoice_number} references inactive product '{product.name}'",
                details={
                    "sale_id": str(sale.id),
                    "product_id": str(product.id),
                    "product_name": product.name,
                    "invoice_number": sale.invoice_number,
                },
            )
            new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"sales_checked": records_checked}}

    async def _check_sale_references_invalid_customer(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check if any sale references a non-existent or invalid customer."""
        result = await db.execute(
            select(Sale)
            .where(Sale.company_id == company_id)
            .where(Sale.customer_id.is_not(None))
            .where(Sale.status == SaleStatus.COMPLETED)
            .outerjoin(Customer, Sale.customer_id == Customer.id)
            .where(Customer.id.is_(None))
        )
        sales = result.scalars().all()

        records_checked = len(sales)
        new_issues = 0

        for sale in sales:
            await self._create_or_update_issue(
                db,
                company_id,
                DataQualityIssueType.SALE_REFERENCES_INVALID_CUSTOMER,
                DataQualityIssueSeverity.MEDIUM,
                "sales",
                sale.id,
                "sale",
                f"Sale {sale.invoice_number} references invalid or non-existent customer ID {sale.customer_id}",
                details={
                    "sale_id": str(sale.id),
                    "customer_id": str(sale.customer_id),
                    "invoice_number": sale.invoice_number,
                },
            )
            new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"sales_checked": records_checked}}

    async def _check_duplicate_product_skus(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check for duplicate product SKUs within a company."""
        result = await db.execute(
            select(Product.sku, func.count(Product.id).label("count"))
            .where(Product.company_id == company_id)
            .group_by(Product.sku)
            .having(func.count(Product.id) > 1)
        )
        duplicates = result.all()

        records_checked = len(duplicates)
        new_issues = 0

        for sku, count in duplicates:
            products_result = await db.execute(
                select(Product).where(Product.company_id == company_id).where(Product.sku == sku)
            )
            products = products_result.scalars().all()

            await self._create_or_update_issue(
                db,
                company_id,
                DataQualityIssueType.DUPLICATE_PRODUCT_SKU,
                DataQualityIssueSeverity.HIGH,
                "products",
                products[0].id if products else None,
                "product",
                f"Duplicate SKU '{sku}' found on {count} products",
                details={
                    "sku": sku,
                    "duplicate_count": count,
                    "product_ids": [str(p.id) for p in products],
                    "product_names": [p.name for p in products],
                },
            )
            new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"duplicate_skus": records_checked}}

    async def _check_missing_mandatory_product_info(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check for products missing mandatory information."""
        result = await db.execute(
            select(Product).where(Product.company_id == company_id)
        )
        products = result.scalars().all()

        records_checked = len(products)
        new_issues = 0

        for product in products:
            missing = []
            if not product.name or not product.name.strip():
                missing.append("name")
            if not product.sku or not product.sku.strip():
                missing.append("sku")
            if product.unit_price is None or product.unit_price <= 0:
                missing.append("unit_price")
            if product.cost_price is None or product.cost_price <= 0:
                missing.append("cost_price")

            if missing:
                await self._create_or_update_issue(
                    db,
                    company_id,
                    DataQualityIssueType.MISSING_MANDATORY_PRODUCT_INFO,
                    DataQualityIssueSeverity.MEDIUM,
                    "products",
                    product.id,
                    "product",
                    f"Product '{product.name or 'Unknown'}' missing mandatory fields: {', '.join(missing)}",
                    details={
                        "product_id": str(product.id),
                        "product_name": product.name or "",
                        "sku": product.sku or "",
                        "missing_fields": missing,
                    },
                )
                new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"products_checked": records_checked}}

    async def _check_missing_mandatory_customer_info(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check for customers missing mandatory information."""
        result = await db.execute(
            select(Customer).where(Customer.company_id == company_id).where(Customer.is_deleted == False)
        )
        customers = result.scalars().all()

        records_checked = len(customers)
        new_issues = 0

        for customer in customers:
            missing = []
            if not customer.first_name or not customer.first_name.strip():
                missing.append("first_name")
            if not customer.last_name or not customer.last_name.strip():
                missing.append("last_name")

            if missing:
                await self._create_or_update_issue(
                    db,
                    company_id,
                    DataQualityIssueType.MISSING_MANDATORY_CUSTOMER_INFO,
                    DataQualityIssueSeverity.MEDIUM,
                    "customers",
                    customer.id,
                    "customer",
                    f"Customer '{customer.first_name or ''} {customer.last_name or ''}'.strip() missing mandatory fields: {', '.join(missing)}",
                    details={
                        "customer_id": str(customer.id),
                        "customer_name": f"{customer.first_name or ''} {customer.last_name or ''}".strip(),
                        "missing_fields": missing,
                    },
                )
                new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"customers_checked": records_checked}}

    async def _check_stock_movement_inconsistent_quantities(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check stock movements where quantity_changed doesn't match previous - updated."""
        result = await db.execute(
            select(StockMovement).where(StockMovement.company_id == company_id)
        )
        movements = result.scalars().all()

        records_checked = len(movements)
        new_issues = 0

        for movement in movements:
            expected_change = movement.updated_quantity - movement.previous_quantity
            if movement.quantity_changed != expected_change:
                await self._create_or_update_issue(
                    db,
                    company_id,
                    DataQualityIssueType.STOCK_MOVEMENT_INCONSISTENT_QUANTITIES,
                    DataQualityIssueSeverity.HIGH,
                    "inventory",
                    movement.id,
                    "stock_movement",
                    f"Stock movement {movement.id} quantity_changed ({movement.quantity_changed}) inconsistent with previous ({movement.previous_quantity}) -> updated ({movement.updated_quantity})",
                    details={
                        "movement_id": str(movement.id),
                        "product_id": str(movement.product_id),
                        "movement_type": movement.movement_type.value,
                        "previous_quantity": movement.previous_quantity,
                        "updated_quantity": movement.updated_quantity,
                        "quantity_changed": movement.quantity_changed,
                        "expected_change": expected_change,
                    },
                )
                new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"movements_checked": records_checked}}

    async def _check_report_total_mismatch(
        self, db: AsyncSession, company_id: UUID
    ) -> Dict[str, Any]:
        """Check if report history totals match underlying transaction data."""
        from app.models.report import ReportHistory, ReportExecutionStatus

        result = await db.execute(
            select(ReportHistory)
            .where(ReportHistory.company_id == company_id)
            .where(ReportHistory.status == ReportExecutionStatus.COMPLETED)
        )
        reports = result.scalars().all()

        records_checked = len(reports)
        new_issues = 0

        for report in reports:
            file_data = report.file_data or {}
            if not file_data:
                continue

            # For sales reports, compare total_amount from file_data against actual sales
            if report.report_type.value == "sales":
                sales_result = await db.execute(
                    select(func.coalesce(func.sum(Sale.total_amount), 0))
                    .where(Sale.company_id == company_id)
                    .where(Sale.status == SaleStatus.COMPLETED)
                )
                actual_total = float(sales_result.scalar_one() or 0)

                reported_total = float(file_data.get("total_amount", 0) or 0)
                if abs(actual_total - reported_total) > 0.01:
                    await self._create_or_update_issue(
                        db,
                        company_id,
                        DataQualityIssueType.REPORT_TOTAL_MISMATCH,
                        DataQualityIssueSeverity.HIGH,
                        "reports",
                        report.id,
                        "report_history",
                        f"Report '{report.report_name}' total ({reported_total}) doesn't match actual sales total ({actual_total})",
                        details={
                            "report_id": str(report.id),
                            "report_name": report.report_name,
                            "reported_total": reported_total,
                            "actual_total": actual_total,
                            "difference": actual_total - reported_total,
                        },
                    )
                    new_issues += 1

        return {"records_checked": records_checked, "new_issues": new_issues, "details": {"reports_checked": records_checked}}

    async def check_sale_data_quality(
        self,
        db: AsyncSession,
        company_id: UUID,
        sale,
        sale_items: List,
    ) -> int:
        """Run targeted data quality checks on a newly created sale. Returns number of new issues."""
        new_issues = 0

        for item in sale_items:
            product = item.product if hasattr(item, 'product') else None
            if not product:
                product_result = await db.execute(select(Product).where(Product.id == item.product_id))
                product = product_result.scalar_one_or_none()

            if product:
                if product.status == ProductStatus.INACTIVE:
                    created = await self._create_or_update_issue(
                        db, company_id,
                        DataQualityIssueType.SALE_REFERENCES_INACTIVE_PRODUCT,
                        DataQualityIssueSeverity.MEDIUM,
                        "sales", sale.id, "sale",
                        f"Sale {sale.invoice_number} references inactive product '{product.name}'",
                        details={"sale_id": str(sale.id), "product_id": str(product.id), "product_name": product.name, "invoice_number": sale.invoice_number},
                    )
                    if created:
                        new_issues += 1

                if item.quantity > product.stock_quantity:
                    created = await self._create_or_update_issue(
                        db, company_id,
                        DataQualityIssueType.SALE_EXCEEDS_STOCK,
                        DataQualityIssueSeverity.HIGH,
                        "sales", sale.id, "sale",
                        f"Sale item quantity {item.quantity} exceeds available stock {product.stock_quantity} for product '{product.name}'",
                        details={"sale_id": str(sale.id), "sale_item_id": str(item.id), "product_id": str(product.id), "product_name": product.name, "quantity_sold": item.quantity, "available_stock": product.stock_quantity, "invoice_number": sale.invoice_number},
                    )
                    if created:
                        new_issues += 1

        if sale.customer_id:
            customer_result = await db.execute(select(Customer).where(Customer.id == sale.customer_id))
            customer = customer_result.scalar_one_or_none()
            if not customer:
                created = await self._create_or_update_issue(
                    db, company_id,
                    DataQualityIssueType.SALE_REFERENCES_INVALID_CUSTOMER,
                    DataQualityIssueSeverity.MEDIUM,
                    "sales", sale.id, "sale",
                    f"Sale {sale.invoice_number} references invalid or non-existent customer ID {sale.customer_id}",
                    details={"sale_id": str(sale.id), "customer_id": str(sale.customer_id), "invoice_number": sale.invoice_number},
                )
                if created:
                    new_issues += 1

        return new_issues

    async def check_stock_movement_data_quality(
        self,
        db: AsyncSession,
        company_id: UUID,
        movement,
    ) -> int:
        """Run targeted data quality checks on a stock movement. Returns number of new issues."""
        expected_change = movement.updated_quantity - movement.previous_quantity
        if movement.quantity_changed != expected_change:
            created = await self._create_or_update_issue(
                db, company_id,
                DataQualityIssueType.STOCK_MOVEMENT_INCONSISTENT_QUANTITIES,
                DataQualityIssueSeverity.HIGH,
                "inventory", movement.id, "stock_movement",
                f"Stock movement {movement.id} quantity_changed ({movement.quantity_changed}) inconsistent with previous ({movement.previous_quantity}) -> updated ({movement.updated_quantity})",
                details={"movement_id": str(movement.id), "product_id": str(movement.product_id), "movement_type": movement.movement_type.value, "previous_quantity": movement.previous_quantity, "updated_quantity": movement.updated_quantity, "quantity_changed": movement.quantity_changed, "expected_change": expected_change},
            )
            if created:
                return 1
        return 0

    async def get_dashboard_stats(self, db: AsyncSession, company_id: UUID) -> Dict[str, Any]:
        """Get dashboard statistics for data quality."""
        total_issues_result = await db.execute(
            select(func.count(DataQualityIssue.id)).where(DataQualityIssue.company_id == company_id)
        )
        total_issues = int(total_issues_result.scalar_one() or 0)

        open_issues_result = await db.execute(
            select(func.count(DataQualityIssue.id)).where(
                DataQualityIssue.company_id == company_id,
                DataQualityIssue.status == DataQualityIssueStatus.OPEN,
            )
        )
        open_issues = int(open_issues_result.scalar_one() or 0)

        investigating_issues_result = await db.execute(
            select(func.count(DataQualityIssue.id)).where(
                DataQualityIssue.company_id == company_id,
                DataQualityIssue.status == DataQualityIssueStatus.INVESTIGATING,
            )
        )
        investigating_issues = int(investigating_issues_result.scalar_one() or 0)

        resolved_issues_result = await db.execute(
            select(func.count(DataQualityIssue.id)).where(
                DataQualityIssue.company_id == company_id,
                DataQualityIssue.status == DataQualityIssueStatus.RESOLVED,
            )
        )
        resolved_issues = int(resolved_issues_result.scalar_one() or 0)

        last_run_result = await db.execute(
            select(ReconciliationRun)
            .where(ReconciliationRun.company_id == company_id)
            .order_by(desc(ReconciliationRun.started_at))
        )
        last_run = last_run_result.scalars().first()

        return {
            "total_records_checked": last_run.records_checked if last_run else 0,
            "valid_records": max(0, (last_run.records_checked if last_run else 0) - total_issues),
            "records_with_warnings": open_issues,
            "records_with_errors": investigating_issues,
            "unresolved_issues": open_issues + investigating_issues,
            "last_reconciliation_time": last_run.started_at if last_run else None,
            "total_issues": total_issues,
            "resolved_issues": resolved_issues,
        }


data_quality_service = DataQualityService()
