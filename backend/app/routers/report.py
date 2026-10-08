from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime
from io import StringIO, BytesIO
import csv
import json
from app.database import get_db
from app.models.user import UserRole
from app.schemas.report import (
    ScheduledReportCreate,
    ScheduledReportUpdate,
    ScheduledReportResponse,
    ReportHistoryResponse,
    ReportHistoryListResponse,
    ScheduledReportListResponse,
    ReportGenerateRequest,
    ReportGenerateResponse,
    ReportDataResponse,
    ReportFilterBase,
)
from app.utils.dependencies import get_current_active_user
from app.crud import report as report_crud
from app.services import report as report_service
from app.services.audit import audit_service

router = APIRouter(prefix="/reports", tags=["reports"])


def is_admin_or_analyst(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN)


def _build_report_name(report_type: str) -> str:
    mapping = {
        "sales": "Sales Report",
        "inventory": "Inventory Report",
        "customer": "Customer Report",
        "product_performance": "Product Performance Report",
        "stock_movement": "Stock Movement Report",
    }
    return mapping.get(report_type, report_type.replace("_", " ").title() + " Report")


@router.post("/generate", response_model=ReportGenerateResponse)
async def generate_report(
    payload: ReportGenerateRequest,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    filters_dict = {}
    if payload.filters:
        filters_dict = payload.filters.model_dump(exclude_none=True)

    report_name = _build_report_name(payload.report_type.value)
    history = await report_crud.create_report_history(
        db=db,
        company_id=current_user.company_id,
        report_name=report_name,
        report_type=payload.report_type.value,
        filters=filters_dict,
        export_format=payload.export_format.value,
        generated_by=current_user.id,
        status="processing",
    )

    try:
        data = await report_service.generate_report_data(
            db=db,
            company_id=current_user.company_id,
            report_type=payload.report_type,
            filters=filters_dict,
        )
        if payload.export_format.value == "csv":
            file_content = report_service.generate_csv(data, report_name)
            file_data = {"content": file_content, "filename": f"{report_name.replace(' ', '_').lower()}.csv", "content_type": "text/csv"}
        else:
            file_content = report_service.generate_pdf(data, report_name)
            file_data = {"content": file_content.hex(), "filename": f"{report_name.replace(' ', '_').lower()}.pdf", "content_type": "application/pdf"}

        await report_crud.update_report_history(db=db, history_id=history.id, status="completed", file_data=file_data)
        await audit_service.log(
            db, current_user.company_id, current_user.id, "Report Generated", request,
            resource_type="Report", resource_id=history.id, description=f"Generated {report_name} as {payload.export_format.value.upper()}"
        )
        return ReportGenerateResponse(
            id=history.id,
            report_name=report_name,
            report_type=payload.report_type,
            export_format=payload.export_format,
            status="completed",
            generated_at=history.generated_at,
            download_url=f"/api/reports/history/{history.id}/download",
        )
    except Exception as e:
        await report_crud.update_report_history(db=db, history_id=history.id, status="failed", error_message=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Report generation failed: {str(e)}")


@router.get("/data", response_model=ReportDataResponse)
async def get_report_data(
    report_type: str = Query(..., pattern="^(sales|inventory|customer|product_performance|stock_movement)$"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    product_id: Optional[UUID] = Query(None),
    category_id: Optional[UUID] = Query(None),
    brand: Optional[str] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    sales_status: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    sales_channel: Optional[str] = Query(None),
    movement_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    filters = {
        "date_from": date_from,
        "date_to": date_to,
        "product_id": str(product_id) if product_id else None,
        "category_id": str(category_id) if category_id else None,
        "brand": brand,
        "customer_id": str(customer_id) if customer_id else None,
        "sales_status": sales_status,
        "stock_status": stock_status,
        "payment_method": payment_method,
        "payment_status": payment_status,
        "sales_channel": sales_channel,
        "movement_type": movement_type,
        "search": search,
    }
    filters = {k: v for k, v in filters.items() if v is not None}

    try:
        data = await report_service.generate_report_data(
            db=db,
            company_id=current_user.company_id,
            report_type=report_type,
            filters=filters,
            page=page,
            page_size=page_size,
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate report data: {str(e)}")


@router.get("/history", response_model=ReportHistoryListResponse)
async def list_report_history(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    report_type: Optional[str] = Query(None),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    items, total = await report_crud.list_report_history(
        db=db, company_id=current_user.company_id, page=page, page_size=page_size, report_type=report_type
    )
    return ReportHistoryListResponse(
        items=[ReportHistoryResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/history/{history_id}", response_model=ReportHistoryResponse)
async def get_report_history_item(
    history_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    item = await report_crud.get_report_history(db=db, history_id=history_id, company_id=current_user.company_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report history not found")
    return ReportHistoryResponse.model_validate(item)


@router.get("/history/{history_id}/download")
async def download_report(
    history_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    item = await report_crud.get_report_history(db=db, history_id=history_id, company_id=current_user.company_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report history not found")
    if item.status.value != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Report is not ready for download. Status: {item.status.value}")
    if not item.file_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No file data available for this report")

    content = item.file_data.get("content", "")
    filename = item.file_data.get("filename", f"report_{history_id}")
    content_type = item.file_data.get("content_type", "application/octet-stream")

    if item.export_format.value == "pdf":
        content = bytes.fromhex(content)

    return Response(content=content, media_type=content_type, headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.post("/schedules", response_model=ScheduledReportResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_report(
    payload: ScheduledReportCreate,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    if not payload.recipients:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one recipient is required")

    report = await report_crud.create_scheduled_report(
        db=db, obj_in=payload, company_id=current_user.company_id, created_by=current_user.id
    )
    await audit_service.log(
        db, current_user.company_id, current_user.id, "Scheduled Report Created", request,
        resource_type="ScheduledReport", resource_id=report.id, description=f"Created scheduled report '{report.name}'"
    )
    return ScheduledReportResponse.model_validate(report)


@router.get("/schedules", response_model=ScheduledReportListResponse)
async def list_scheduled_reports(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    items, total = await report_crud.list_scheduled_reports(
        db=db, company_id=current_user.company_id, page=page, page_size=page_size, is_active=is_active
    )
    return ScheduledReportListResponse(
        items=[ScheduledReportResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/schedules/{report_id}", response_model=ScheduledReportResponse)
async def get_scheduled_report(
    report_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    report = await report_crud.get_scheduled_report(db=db, report_id=report_id, company_id=current_user.company_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled report not found")
    return ScheduledReportResponse.model_validate(report)


@router.put("/schedules/{report_id}", response_model=ScheduledReportResponse)
async def update_scheduled_report(
    report_id: UUID,
    payload: ScheduledReportUpdate,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    report = await report_crud.update_scheduled_report(
        db=db, report_id=report_id, company_id=current_user.company_id, obj_in=payload
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled report not found")
    await audit_service.log(
        db, current_user.company_id, current_user.id, "Scheduled Report Updated", request,
        resource_type="ScheduledReport", resource_id=report.id, description=f"Updated scheduled report '{report.name}'"
    )
    return ScheduledReportResponse.model_validate(report)


@router.delete("/schedules/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_report(
    report_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    deleted = await report_crud.delete_scheduled_report(db=db, report_id=report_id, company_id=current_user.company_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled report not found")
    await audit_service.log(
        db, current_user.company_id, current_user.id, "Scheduled Report Deleted", request,
        resource_type="ScheduledReport", resource_id=report_id, description="Deleted scheduled report"
    )
    return None
