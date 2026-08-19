import csv
import io
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from app.database import get_db
from app.models.user import UserRole
from app.schemas.analytics import (
    AnalyticsFilters,
    KPIDashboardResponse,
    RevenueTrendPoint,
    SalesTrendPoint,
    TopProductResponse,
    TopCategoryResponse,
    PaymentMethodBreakdown,
    SalesChannelBreakdown,
    InventoryDistributionCategory,
    StockStatusSummary,
    LowStockProductResponse,
    OutOfStockProductResponse,
    InventoryValueByCategory,
    DrillDownTransactionResponse,
    DrillDownProductResponse,
    DrillDownCategoryProductResponse,
    DrillDownProductTransactionResponse,
    KPIDetailResponse,
    ExportRequest,
    RefreshResponse,
)
from app.schemas.customer import TopCustomerResponse
from app.utils.dependencies import get_current_active_user
from app.services.analytics import analytics_service


router = APIRouter(prefix="/analytics", tags=["analytics"])


def is_admin_or_analyst(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN)


def _parse_filters(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    sales_channel: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
) -> dict:
    from datetime import datetime, time

    filters = {}
    if date_from:
        try:
            filters["date_from"] = datetime.fromisoformat(date_from)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date_from format. Use YYYY-MM-DD.")
    if date_to:
        try:
            filters["date_to"] = datetime.combine(datetime.fromisoformat(date_to).date(), time.max)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date_to format. Use YYYY-MM-DD.")
    if product_id:
        try:
            filters["product_id"] = UUID(product_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product_id format.")
    if category_id:
        try:
            filters["category_id"] = UUID(category_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id format.")
    if brand:
        filters["brand"] = brand
    if sales_channel:
        filters["sales_channel"] = sales_channel
    if payment_method:
        filters["payment_method"] = payment_method
    if customer_id:
        try:
            filters["customer_id"] = UUID(customer_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer_id format.")
    return filters if filters else None


@router.get("/kpis", response_model=KPIDashboardResponse)
async def get_kpi_dashboard(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    data = await analytics_service.get_kpi_dashboard(db, current_user.company_id, filters)
    return KPIDashboardResponse(**data)


@router.get("/revenue-trend", response_model=list[RevenueTrendPoint])
async def get_revenue_trend(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    interval: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_revenue_trend(db, current_user.company_id, filters, interval)
    return [RevenueTrendPoint(**item) for item in data]


@router.get("/sales-trend", response_model=list[SalesTrendPoint])
async def get_sales_trend(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    interval: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_sales_trend(db, current_user.company_id, filters, interval)
    return [SalesTrendPoint(**item) for item in data]


@router.get("/top-products", response_model=dict)
async def get_top_products(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    sort_by: str = Query("total_quantity", pattern="^(total_quantity|total_revenue)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_top_products(db, current_user.company_id, filters, page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order)
    return data


@router.get("/top-categories", response_model=dict)
async def get_top_categories(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_top_categories(db, current_user.company_id, filters, page=page, page_size=page_size)
    return data


@router.get("/top-customers", response_model=dict)
async def get_top_customers(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_top_customers(db, current_user.company_id, filters, page=page, page_size=page_size)
    return data


@router.get("/payment-methods", response_model=list[PaymentMethodBreakdown])
async def get_payment_methods(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_payment_method_breakdown(db, current_user.company_id, filters)
    return [PaymentMethodBreakdown(**item) for item in data]


@router.get("/sales-channels", response_model=list[SalesChannelBreakdown])
async def get_sales_channels(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_sales_channel_breakdown(db, current_user.company_id, filters)
    return [SalesChannelBreakdown(**item) for item in data]


@router.get("/inventory-distribution", response_model=list[InventoryDistributionCategory])
async def get_inventory_distribution(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_inventory_distribution(db, current_user.company_id, filters)
    return [InventoryDistributionCategory(**item) for item in data]


@router.get("/stock-status", response_model=list[StockStatusSummary])
async def get_stock_status(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_stock_status_summary(db, current_user.company_id, filters)
    return [StockStatusSummary(**item) for item in data]


@router.get("/low-stock", response_model=list[LowStockProductResponse])
async def get_low_stock(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_low_stock_products(db, current_user.company_id, filters, limit)
    return [LowStockProductResponse(**item) for item in data]


@router.get("/out-of-stock", response_model=list[OutOfStockProductResponse])
async def get_out_of_stock(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_out_of_stock_products(db, current_user.company_id, filters, limit)
    return [OutOfStockProductResponse(**item) for item in data]


@router.get("/inventory-value", response_model=list[InventoryValueByCategory])
async def get_inventory_value(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_inventory_value_by_category(db, current_user.company_id, filters)
    return [InventoryValueByCategory(**item) for item in data]


@router.get("/drill-down/transactions", response_model=list[DrillDownTransactionResponse])
async def drill_down_transactions(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.drill_down_transactions(db, current_user.company_id, filters)
    return [DrillDownTransactionResponse(**item) for item in data]


@router.get("/drill-down/products", response_model=list[DrillDownProductResponse])
async def drill_down_products(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.drill_down_products(db, current_user.company_id, filters)
    return [DrillDownProductResponse(**item) for item in data]


@router.get("/drill-down/category-products", response_model=list[DrillDownCategoryProductResponse])
async def drill_down_category_products(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    category_id: Optional[str] = Query(None),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if not category_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="category_id is required")
    data = await analytics_service.drill_down_category_products(db, current_user.company_id, UUID(category_id), filters)
    return [DrillDownCategoryProductResponse(**item) for item in data]


@router.get("/drill-down/product-transactions", response_model=list[DrillDownProductTransactionResponse])
async def drill_down_product_transactions(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    product_id: Optional[str] = Query(None),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if not product_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="product_id is required")
    data = await analytics_service.drill_down_product_transactions(db, current_user.company_id, UUID(product_id), filters)
    return [DrillDownProductTransactionResponse(**item) for item in data]


@router.get("/drill-down/kpi-detail", response_model=KPIDetailResponse)
async def drill_down_kpi_detail(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.drill_down_kpi_detail(db, current_user.company_id, filters)
    return KPIDetailResponse(**data)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_analytics(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    from datetime import datetime as dt
    return RefreshResponse(status="refreshed", timestamp=dt.utcnow().isoformat())


@router.post("/log")
async def log_analytics_event(
    payload: dict,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    action = payload.get("action", "")
    entity_name = payload.get("entity_name", "")
    details = payload.get("details")
    export_type = payload.get("export_type")
    if not action:
        raise HTTPException(status_code=400, detail="action is required")
    await analytics_service.log_analytics_event(db, current_user.company_id, current_user.id, action, request, entity_name, details, export_type)
    return {"status": "logged"}


@router.post("/export")
async def export_analytics(
    payload: ExportRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    filters_dict = None
    if payload.filters:
        filters_dict = payload.filters.model_dump() if hasattr(payload.filters, "model_dump") else payload.filters.dict()

    filename = f"{payload.report_type}_report"

    if payload.report_type == "kpis":
        data = await analytics_service.get_kpi_dashboard(db, current_user.company_id, filters_dict)
        rows = [data] if data else []
    elif payload.report_type == "sales":
        data = await analytics_service.get_sales_trend(db, current_user.company_id, filters_dict, "daily")
        rows = data if data else []
        filename += "_sales_trend"
    elif payload.report_type == "inventory":
        data = await analytics_service.get_inventory_distribution(db, current_user.company_id, filters_dict)
        rows = data if data else []
        filename += "_inventory"
    elif payload.report_type == "transactions":
        data = await analytics_service.drill_down_transactions(db, current_user.company_id, filters_dict)
        rows = data if data else []
        filename += "_transactions"
    elif payload.report_type == "top-products":
        data = await analytics_service.get_top_products(db, current_user.company_id, filters_dict, page=1, page_size=0)
        rows = data.get("items", []) if isinstance(data, dict) else data
        filename += "_top_products"
    elif payload.report_type == "top-customers":
        data = await analytics_service.get_top_customers(db, current_user.company_id, filters_dict, page=1, page_size=0)
        rows = data.get("items", []) if isinstance(data, dict) else data
        filename += "_top_customers"
    elif payload.report_type == "payment-methods":
        data = await analytics_service.get_payment_method_breakdown(db, current_user.company_id, filters_dict)
        rows = data if data else []
        filename += "_payment_methods"
    else:
        raise HTTPException(status_code=400, detail="Unsupported report type")

    await analytics_service.log_analytics_event(
        db, current_user.company_id, current_user.id, "Report Exported", request,
        entity_name=payload.report_type,
        details=f"Exported {payload.report_type} as {payload.export_type}",
        export_type=payload.export_type,
    )

    if payload.export_type == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys() if rows else [])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        csv_content = output.getvalue()
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"},
        )

    if payload.export_type == "pdf":
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        story.append(Paragraph(f"{current_user.company or 'RetailPulse Analytics'} - Analytics Report", styles["Title"]))
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Report Type: {payload.report_type.upper()}", styles["Normal"]))
        story.append(Spacer(1, 12))

        if rows:
            table_data = [list(rows[0].keys())]
            for row in rows:
                table_data.append([str(v) for v in row.values()])
            table = Table(table_data)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(table)
        else:
            story.append(Paragraph("No data available for the selected filters.", styles["Normal"]))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}.pdf"})

    raise HTTPException(status_code=400, detail="Unsupported export type")
