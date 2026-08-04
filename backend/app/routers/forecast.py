import csv
import io
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from app.database import get_db
from app.models.user import UserRole
from app.models.forecast import ForecastPeriodType
from app.schemas.forecast import (
    ForecastGenerateRequest,
    DemandForecastResponse,
    DemandForecastListItem,
    CategoryForecastResponse,
    ForecastKPIsResponse,
    ForecastHistoryResponse,
    ForecastExportResponse,
)
from app.utils.dependencies import get_current_active_user
from app.crud.forecast import demand_forecast as forecast_crud
from app.services.forecast import forecast_service
from app.services.audit import audit_service
from app.crud.notification import notification as notification_crud
from app.models.notification import NotificationType


router = APIRouter(prefix="/forecast", tags=["forecast"])


def is_admin_or_analyst(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN)


@router.get("/kpis", response_model=ForecastKPIsResponse)
async def get_forecast_kpis(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    forecast_period: Optional[str] = Query(None),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    fp = None
    if forecast_period:
        try:
            fp = ForecastPeriodType(forecast_period)
        except ValueError:
            pass

    data = await forecast_crud.get_kpis(db, current_user.company_id, fp)
    return ForecastKPIsResponse(**data)


@router.get("/products", response_model=dict)
async def list_product_forecasts(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    product_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    forecast_period: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("predicted_demand"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    skip = (page - 1) * limit
    pid = UUID(product_id) if product_id else None
    cid = UUID(category_id) if category_id else None
    fp = ForecastPeriodType(forecast_period) if forecast_period else None

    items, total = await forecast_crud.list(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
        product_id=pid,
        category_id=cid,
        forecast_period=fp,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    return {"data": [DemandForecastListItem(**item) for item in items], "total": total, "page": page, "limit": limit}


@router.get("/categories", response_model=dict)
async def list_category_forecasts(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    forecast_period: Optional[str] = Query(None),
    sort_by: str = Query("predicted_demand"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    skip = (page - 1) * limit
    fp = ForecastPeriodType(forecast_period) if forecast_period else None

    items, total = await forecast_crud.list_category_forecasts(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
        forecast_period=fp,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    return {"data": [CategoryForecastResponse(**item) for item in items], "total": total, "page": page, "limit": limit}


@router.post("/generate", response_model=List[DemandForecastResponse])
async def generate_forecasts(
    payload: ForecastGenerateRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    try:
        forecasts = await forecast_service.generate_with_notifications(
            db,
            current_user.company_id,
            current_user.id,
            payload.forecast_period,
            request,
            payload.forecast_start_date,
            payload.forecast_end_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return [DemandForecastResponse(**f.__dict__) for f in forecasts]


@router.post("/refresh", response_model=List[DemandForecastResponse])
async def refresh_forecasts(
    payload: ForecastGenerateRequest,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    forecasts = await forecast_service.refresh_with_notifications(
        db,
        current_user.company_id,
        current_user.id,
        payload.forecast_period,
        request,
    )
    return [DemandForecastResponse(**f.__dict__) for f in forecasts]


@router.get("/charts/top-products", response_model=dict)
async def get_top_predicted_products(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    forecast_period: Optional[str] = Query(None),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    fp = ForecastPeriodType(forecast_period) if forecast_period else ForecastPeriodType.NEXT_30_DAYS
    data = await forecast_service.get_chart_data(db, current_user.company_id, fp)
    return data


@router.get("/charts/accuracy-trend", response_model=List[dict])
async def get_accuracy_trend(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    data = await forecast_service.get_forecast_accuracy_trend(db, current_user.company_id)
    return data


@router.get("/export/products", response_model=ForecastExportResponse)
async def export_product_forecast_csv(
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    forecast_period: Optional[str] = Query(None),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    fp = ForecastPeriodType(forecast_period) if forecast_period else None
    items, _ = await forecast_crud.list(db, current_user.company_id, limit=10000, forecast_period=fp)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Product", "SKU", "Category", "Brand", "Current Stock", "Historical Sales", "Predicted Demand", "Confidence", "Recommendation", "Generated At"])
    for item in items:
        writer.writerow([
            item.get("product_name", ""),
            item.get("product_sku", ""),
            item.get("category_name", ""),
            item.get("brand", ""),
            item.get("current_stock", 0),
            item.get("historical_sales", 0),
            item.get("predicted_demand", 0),
            item.get("confidence_score", 0),
            item.get("recommendation", ""),
            item.get("generated_at", ""),
        ])

    await audit_service.log(
        db=db,
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="Forecast Exported",
        request=request,
        entity_name="Product Forecast",
        details=f"Exported product forecast CSV for period {forecast_period or 'all'}",
    )
    await db.commit()

    return ForecastExportResponse(content=output.getvalue(), filename="product_forecast_report.csv", content_type="text/csv")


@router.get("/export/categories", response_model=ForecastExportResponse)
async def export_category_forecast_csv(
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    forecast_period: Optional[str] = Query(None),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    fp = ForecastPeriodType(forecast_period) if forecast_period else None
    items, _ = await forecast_crud.list_category_forecasts(db, current_user.company_id, limit=10000, forecast_period=fp)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Category", "Total Historical Sales", "Predicted Demand", "Expected Growth %", "Forecast Period", "Generated At"])
    for item in items:
        writer.writerow([
            item.get("category_name", ""),
            item.get("total_historical_sales", 0),
            item.get("predicted_demand", 0),
            item.get("expected_growth_percentage", 0),
            item.get("forecast_period", ""),
            item.get("generated_at", ""),
        ])

    await audit_service.log(
        db=db,
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="Forecast Exported",
        request=request,
        entity_name="Category Forecast",
        details=f"Exported category forecast CSV for period {forecast_period or 'all'}",
    )
    await db.commit()

    return ForecastExportResponse(content=output.getvalue(), filename="category_forecast_report.csv", content_type="text/csv")


@router.get("/export/report")
async def export_forecast_pdf(
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    forecast_period: Optional[str] = Query(None),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    fp = ForecastPeriodType(forecast_period) if forecast_period else None
    items, _ = await forecast_crud.list(db, current_user.company_id, limit=10000, forecast_period=fp)

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from io import BytesIO

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    elements.append(Paragraph("Demand Forecast Report", styles["Title"]))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"Period: {forecast_period or 'All'}", styles["Normal"]))
    elements.append(Spacer(1, 12))

    data = [["Product", "SKU", "Category", "Predicted Demand", "Confidence", "Recommendation"]]
    for item in items:
        data.append([
            item.get("product_name", ""),
            item.get("product_sku", ""),
            item.get("category_name", ""),
            str(item.get("predicted_demand", 0)),
            f"{item.get('confidence_score', 0)}%",
            str(item.get("recommendation", "") or ""),
        ])

    table = Table(data)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ("GRID", (0, 0), (-1, -1), 1, colors.grey),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)
    doc.build(elements)

    await audit_service.log(
        db=db,
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="Forecast Exported",
        request=request,
        entity_name="Forecast Report",
        details=f"Exported forecast PDF for period {forecast_period or 'all'}",
    )
    await db.commit()

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=forecast_report.pdf"},
    )


# NOTE: /{forecast_id} MUST be declared LAST — it is a catch-all that would
# intercept /charts/*, /export/*, etc. if placed earlier in the router.
@router.get("/{forecast_id}", response_model=DemandForecastResponse)
async def get_forecast(
    forecast_id: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    fid = UUID(forecast_id)
    forecast = await forecast_crud.get(db, fid)
    if not forecast or forecast.company_id != current_user.company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Forecast not found")
    return DemandForecastResponse(**forecast.__dict__)


@router.get("/{forecast_id}/history", response_model=List[ForecastHistoryResponse])
async def get_forecast_history(
    forecast_id: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    fid = UUID(forecast_id)
    forecast = await forecast_crud.get(db, fid)
    if not forecast or forecast.company_id != current_user.company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Forecast not found")

    histories = await forecast_crud.get_history(db, fid)
    return [ForecastHistoryResponse(**h.__dict__) for h in histories]
