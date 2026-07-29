import csv
import io
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
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
from app.utils.dependencies import get_current_active_user
from app.services.analytics import analytics_service


router = APIRouter(prefix="/analytics", tags=["analytics"])


def is_admin_or_analyst(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN)


def _parse_filters(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    filter_product_id: Optional[str] = Query(None),
    filter_category_id: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    sales_channel: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
) -> dict:
    from datetime import datetime

    filters = {}
    if date_from:
        try:
            filters["date_from"] = datetime.fromisoformat(date_from)
        except ValueError:
            pass
    if date_to:
        try:
            filters["date_to"] = datetime.fromisoformat(date_to)
        except ValueError:
            pass
    if filter_product_id:
        try:
            filters["product_id"] = UUID(filter_product_id)
        except ValueError:
            pass
    if filter_category_id:
        try:
            filters["category_id"] = UUID(filter_category_id)
        except ValueError:
            pass
    if brand:
        filters["brand"] = brand
    if sales_channel:
        filters["sales_channel"] = sales_channel
    if payment_method:
        filters["payment_method"] = payment_method
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


@router.get("/top-products", response_model=list[TopProductResponse])
async def get_top_products(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_top_products(db, current_user.company_id, filters, limit)
    return [TopProductResponse(**item) for item in data]


@router.get("/top-categories", response_model=list[TopCategoryResponse])
async def get_top_categories(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.get_top_categories(db, current_user.company_id, filters, limit)
    return [TopCategoryResponse(**item) for item in data]


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


@router.get("/drill-down/category-products/{category_id}", response_model=list[DrillDownCategoryProductResponse])
async def drill_down_category_products(
    category_id: str = Path(...),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = await analytics_service.drill_down_category_products(db, current_user.company_id, UUID(category_id), filters)
    return [DrillDownCategoryProductResponse(**item) for item in data]


@router.get("/drill-down/product-transactions/{product_id}", response_model=list[DrillDownProductTransactionResponse])
async def drill_down_product_transactions(
    product_id: str = Path(...),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    filters: dict = Depends(_parse_filters),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
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
        filters_dict = payload.filters.model_dump() if hasattr(payload.filters, 'model_dump') else payload.filters.dict()

    data = []
    filename = f"{payload.report_type}_report"

    if payload.report_type == "kpis":
        kpi_data = await analytics_service.get_kpi_dashboard(db, current_user.company_id, filters_dict)
        data = [kpi_data]
    elif payload.report_type == "sales":
        data = await analytics_service.get_sales_trend(db, current_user.company_id, filters_dict, "daily")
        filename += "_sales_trend"
    elif payload.report_type == "inventory":
        data = await analytics_service.get_inventory_distribution(db, current_user.company_id, filters_dict)
        filename += "_inventory"
    elif payload.report_type == "transactions":
        data = await analytics_service.drill_down_transactions(db, current_user.company_id, filters_dict)
        filename += "_transactions"

    await analytics_service.log_analytics_event(
        db, current_user.company_id, current_user.id, "Report Exported", request,
        entity_name=payload.report_type,
        details=f"Exported {payload.report_type} as {payload.export_type}",
        export_type=payload.export_type,
    )

    if payload.export_type == "csv":
        if not data:
            return {"content": "", "filename": f"{filename}.csv", "content_type": "text/csv"}
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        for row in data:
            writer.writerow(row)
        csv_content = output.getvalue()
        return {"content": csv_content, "filename": f"{filename}.csv", "content_type": "text/csv"}

    if payload.export_type == "pdf":
        return {"content": data, "filename": f"{filename}.pdf", "content_type": "application/json", "message": "PDF data generated. Use frontend PDF library to render."}

    raise HTTPException(status_code=400, detail="Unsupported export type")
