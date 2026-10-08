from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID
import csv
import io
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import sale as sale_crud
from app.crud import inventory as inventory_crud
from app.crud import customer as customer_crud
from app.crud import product as product_crud
from app.crud import report as report_crud
from app.models.report import ReportType, ReportExecutionStatus
from app.schemas.report import ReportFilterBase, ReportDataResponse


class ReportService:
    def _apply_filters(self, filters: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not filters:
            return {}
        return filters

    async def generate_report_data(
        self, db: AsyncSession, company_id: UUID, report_type: ReportType, filters: Optional[Dict[str, Any]] = None, page: int = 1, page_size: int = 50
    ) -> ReportDataResponse:
        applied_filters = self._apply_filters(filters)
        period = None
        if applied_filters.get("date_from") or applied_filters.get("date_to"):
            period = {
                "from": applied_filters.get("date_from"),
                "to": applied_filters.get("date_to"),
            }

        if report_type == ReportType.SALES:
            return await self._sales_report(db, company_id, applied_filters, page, page_size, period)
        elif report_type == ReportType.INVENTORY:
            return await self._inventory_report(db, company_id, applied_filters, page, page_size, period)
        elif report_type == ReportType.CUSTOMER:
            return await self._customer_report(db, company_id, applied_filters, page, page_size, period)
        elif report_type == ReportType.PRODUCT_PERFORMANCE:
            return await self._product_performance_report(db, company_id, applied_filters, page, page_size, period)
        elif report_type == ReportType.STOCK_MOVEMENT:
            return await self._stock_movement_report(db, company_id, applied_filters, page, page_size, period)
        else:
            raise ValueError(f"Unsupported report type: {report_type}")

    async def _sales_report(
        self, db: AsyncSession, company_id: UUID, filters: Dict[str, Any], page: int, page_size: int, period: Optional[Dict[str, Any]]
    ) -> ReportDataResponse:
        sales, total = await sale_crud.list_with_items(
            db=db,
            company_id=company_id,
            skip=(page - 1) * page_size,
            limit=page_size,
            search=filters.get("search"),
            customer_name=filters.get("customer_name") or filters.get("customer"),
            product_name=filters.get("product_name") or filters.get("product"),
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
            sales_channel=filters.get("sales_channel"),
            payment_method=filters.get("payment_method"),
            payment_status=filters.get("payment_status"),
            category_id=filters.get("category_id"),
        )
        rows = []
        for sale in sales:
            for item in sale.items:
                rows.append({
                    "invoice_number": sale.invoice_number,
                    "sale_date": sale.sale_date.isoformat() if sale.sale_date else None,
                    "customer_name": sale.customer_name or "Walk-in",
                    "sales_channel": sale.sales_channel.value if hasattr(sale.sales_channel, 'value') else str(sale.sales_channel),
                    "payment_method": sale.payment_method.value if hasattr(sale.payment_method, 'value') else str(sale.payment_method),
                    "payment_status": sale.payment_status.value if hasattr(sale.payment_status, 'value') else str(sale.payment_status),
                    "status": sale.status.value if hasattr(sale.status, 'value') else str(sale.status),
                    "product_name": item.product.name if item.product else "N/A",
                    "category_name": item.category.name if item.category else "N/A",
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                    "discount": float(item.discount),
                    "tax": float(item.tax),
                    "total": float(item.total),
                })
        columns = [
            "invoice_number", "sale_date", "customer_name", "sales_channel", "payment_method", "payment_status", "status",
            "product_name", "category_name", "quantity", "unit_price", "discount", "tax", "total",
        ]
        return ReportDataResponse(
            columns=columns, rows=rows, total_rows=total, applied_filters=filters, period=period
        )

    async def _inventory_report(
        self, db: AsyncSession, company_id: UUID, filters: Dict[str, Any], page: int, page_size: int, period: Optional[Dict[str, Any]]
    ) -> ReportDataResponse:
        items, total = await inventory_crud.inventory.get_inventory_items(
            db=db,
            company_id=company_id,
            search=filters.get("search"),
            category_id=filters.get("category_id"),
            stock_status=filters.get("stock_status"),
            brand=filters.get("brand"),
            skip=(page - 1) * page_size,
            limit=page_size,
        )
        rows = []
        for item in items:
            rows.append({
                "product_name": item.get("name", "N/A"),
                "sku": item.get("sku", "N/A"),
                "category_name": item.get("category_name", "N/A"),
                "stock_quantity": item.get("stock_quantity", 0),
                "reserved_stock": item.get("reserved_stock", 0),
                "available_stock": item.get("available_stock", 0),
                "low_stock_threshold": item.get("low_stock_threshold", 0),
                "stock_status": item.get("stock_status", "UNKNOWN"),
                "unit_price": float(item.get("unit_price", 0) or 0),
                "inventory_value": float(item.get("inventory_value", 0) or 0),
            })
        columns = [
            "product_name", "sku", "category_name", "stock_quantity", "reserved_stock", "available_stock",
            "low_stock_threshold", "stock_status", "unit_price", "inventory_value",
        ]
        return ReportDataResponse(
            columns=columns, rows=rows, total_rows=total, applied_filters=filters, period=period
        )

    async def _customer_report(
        self, db: AsyncSession, company_id: UUID, filters: Dict[str, Any], page: int, page_size: int, period: Optional[Dict[str, Any]]
    ) -> ReportDataResponse:
        from app.models.customer import CustomerStatus, CustomerType
        customer_type_enum = None
        if filters.get("customer_type"):
            try:
                customer_type_enum = CustomerType(filters["customer_type"])
            except ValueError:
                pass
        status_enum = None
        if filters.get("customer_status"):
            try:
                status_enum = CustomerStatus(filters["customer_status"])
            except ValueError:
                pass

        customers, total = await customer_crud.customer.list(
            db=db,
            company_id=company_id,
            skip=(page - 1) * page_size,
            limit=page_size,
            search=filters.get("search"),
            customer_type=customer_type_enum,
            status=status_enum,
            segment=filters.get("segment"),
        )
        rows = []
        for customer in customers:
            rows.append({
                "name": customer.name,
                "email": customer.email,
                "phone": customer.phone,
                "customer_type": customer.customer_type.value if hasattr(customer.customer_type, 'value') else str(customer.customer_type),
                "segment": customer.segment.value if hasattr(customer.segment, 'value') else str(customer.segment),
                "status": customer.status.value if hasattr(customer.status, 'value') else str(customer.status),
                "total_purchases": customer.total_purchases or 0,
                "total_spent": float(customer.total_spent or 0),
                "last_purchase_date": customer.last_purchase_date.isoformat() if customer.last_purchase_date else None,
            })
        columns = [
            "name", "email", "phone", "customer_type", "segment", "status", "total_purchases", "total_spent", "last_purchase_date",
        ]
        return ReportDataResponse(
            columns=columns, rows=rows, total_rows=total, applied_filters=filters, period=period
        )

    async def _product_performance_report(
        self, db: AsyncSession, company_id: UUID, filters: Dict[str, Any], page: int, page_size: int, period: Optional[Dict[str, Any]]
    ) -> ReportDataResponse:
        from app.services.analytics import analytics_service
        top_products_data = await analytics_service.get_top_products(
            db=db,
            company_id=company_id,
            filters=filters or {},
            page=page,
            page_size=page_size,
        )
        rows = []
        for product in top_products_data.get("items", []):
            rows.append({
                "product_name": product.get("product_name", "N/A"),
                "sku": product.get("sku", "N/A"),
                "category_name": product.get("category_name", "N/A"),
                "total_quantity_sold": product.get("total_quantity", 0),
                "total_revenue": float(product.get("total_revenue", 0) or 0),
                "avg_unit_price": float(product.get("unit_price", 0) or 0),
                "stock_quantity": 0,
            })
        columns = [
            "product_name", "sku", "category_name", "total_quantity_sold", "total_revenue", "avg_unit_price", "stock_quantity",
        ]
        return ReportDataResponse(
            columns=columns, rows=rows, total_rows=top_products_data.get("total", 0), applied_filters=filters, period=period
        )

    async def _stock_movement_report(
        self, db: AsyncSession, company_id: UUID, filters: Dict[str, Any], page: int, page_size: int, period: Optional[Dict[str, Any]]
    ) -> ReportDataResponse:
        movements, total = await inventory_crud.inventory.get_stock_movements(
            db=db,
            company_id=company_id,
            product_id=filters.get("product_id"),
            movement_type=filters.get("movement_type"),
            skip=(page - 1) * page_size,
            limit=page_size,
        )
        rows = []
        for movement in movements:
            rows.append({
                "movement_type": movement.movement_type.value if hasattr(movement.movement_type, 'value') else str(movement.movement_type),
                "product_name": movement.product.name if movement.product else "N/A",
                "quantity_changed": movement.quantity_changed,
                "previous_quantity": movement.previous_quantity,
                "updated_quantity": movement.updated_quantity,
                "user_name": movement.user.name if movement.user else "System",
                "notes": movement.notes or "",
                "created_at": movement.created_at.isoformat() if movement.created_at else None,
            })
        columns = [
            "movement_type", "product_name", "quantity_changed", "previous_quantity", "updated_quantity",
            "user_name", "notes", "created_at",
        ]
        return ReportDataResponse(
            columns=columns, rows=rows, total_rows=total, applied_filters=filters, period=period
        )

    def generate_csv(self, data: ReportDataResponse, report_name: str) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([f"Report: {report_name}"])
        writer.writerow([f"Generated At: {datetime.utcnow().isoformat()}"])
        if data.applied_filters:
            writer.writerow(["Applied Filters:"])
            for key, value in data.applied_filters.items():
                if value is not None:
                    writer.writerow([f"  {key}: {value}"])
        if data.period:
            writer.writerow([f"Period: {data.period.get('from')} to {data.period.get('to')}"])
        writer.writerow([])
        writer.writerow(data.columns)
        for row in data.rows:
            writer.writerow([row.get(col, "") for col in data.columns])
        return output.getvalue()

    def generate_pdf(self, data: ReportDataResponse, report_name: str) -> bytes:
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph(f"Report: {report_name}", styles["Title"]))
        story.append(Paragraph(f"Generated At: {datetime.utcnow().isoformat()}", styles["Normal"]))
        if data.period:
            story.append(Paragraph(f"Period: {data.period.get('from')} to {data.period.get('to')}", styles["Normal"]))
        if data.applied_filters:
            story.append(Paragraph("Applied Filters:", styles["Normal"]))
            for key, value in data.applied_filters.items():
                if value is not None:
                    story.append(Paragraph(f"  {key}: {value}", styles["Normal"]))
        story.append(Spacer(1, 12))

        table_data = [data.columns]
        for row in data.rows:
            table_data.append([str(row.get(col, "")) for col in data.columns])

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
        ]))
        story.append(table)
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()


report_service = ReportService()
