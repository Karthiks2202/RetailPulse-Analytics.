from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Optional
from datetime import datetime
from io import BytesIO, StringIO
import csv
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from app.database import get_db
from app.models.user import UserRole
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse, AuditLogListResponse, AuditLogFilter
from app.utils.dependencies import get_current_active_user
from app.crud.audit_log import audit_log as audit_log_crud
from app.services.audit import audit_service

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


def is_admin(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at", pattern="^(created_at|action|resource_type|status)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    skip = (page - 1) * limit
    logs, total = await audit_log_crud.get_multi(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    data = []
    for log in logs:
        user_name = None
        if log.user:
            user_name = log.user.name
        data.append(AuditLogResponse(
            id=log.id,
            company_id=log.company_id,
            user_id=log.user_id,
            user_name=user_name,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            description=log.description,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            before_values=log.before_values,
            after_values=log.after_values,
            status=log.status,
            created_at=log.created_at,
        ))
    return AuditLogListResponse(data=data, total=total, page=page, limit=limit)


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    log = await audit_log_crud.get(db, log_id)
    if not log or log.company_id != current_user.company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found")

    user_name = None
    if log.user:
        user_name = log.user.name
    return AuditLogResponse(
        id=log.id,
        company_id=log.company_id,
        user_id=log.user_id,
        user_name=user_name,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        description=log.description,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        before_values=log.before_values,
        after_values=log.after_values,
        status=log.status,
        created_at=log.created_at,
    )


@router.post("/clear")
async def clear_audit_logs(
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    before_date: Optional[datetime] = Query(None),
    confirm: bool = Query(False),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if not confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Confirmation required. Set confirm=true to proceed.")

    cutoff = before_date or datetime.utcnow()
    deleted_count = await audit_log_crud.clear_logs(db, current_user.company_id, cutoff)

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Audit Logs Cleared",
        request,
        resource_type="AuditLog",
        description=f"Cleared {deleted_count} audit log(s) before {cutoff.isoformat()}",
        status="SUCCESS",
    )
    await db.commit()

    return {"message": f"Cleared {deleted_count} audit log(s)", "deleted_count": deleted_count}


@router.get("/export/csv")
async def export_audit_logs_csv(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    request: Request = None,
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    logs, total = await audit_log_crud.get_multi(
        db,
        current_user.company_id,
        skip=0,
        limit=10000,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        sort_by="created_at",
        sort_dir="desc",
    )

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Audit Logs Exported",
        request,
        resource_type="AuditLog",
        description=f"Exported {len(logs)} audit log(s) as CSV",
        status="SUCCESS",
    )
    await db.commit()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "User", "Action", "Resource Type", "Resource ID", "Description", "IP Address", "User Agent", "Before Values", "After Values", "Status", "Timestamp"])
    for log in logs:
        user_name = log.user.name if log.user else ""
        writer.writerow([
            str(log.id),
            user_name,
            log.action,
            log.resource_type,
            str(log.resource_id) if log.resource_id else "",
            log.description or "",
            log.ip_address,
            log.user_agent,
            str(log.before_values) if log.before_values else "",
            str(log.after_values) if log.after_values else "",
            log.status,
            log.created_at.isoformat() if log.created_at else "",
        ])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit_logs.csv"})


@router.get("/export/pdf")
async def export_audit_logs_pdf(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    request: Request = None,
):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    logs, total = await audit_log_crud.get_multi(
        db,
        current_user.company_id,
        skip=0,
        limit=10000,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        sort_by="created_at",
        sort_dir="desc",
    )

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Audit Logs Exported",
        request,
        resource_type="AuditLog",
        description=f"Exported {len(logs)} audit log(s) as PDF",
        status="SUCCESS",
    )
    await db.commit()

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = [Paragraph("Audit Logs Export", styles["Title"]), Spacer(1, 12)]

    table_data = [
        ["Timestamp", "User", "Action", "Resource", "Resource ID", "Description", "IP Address", "Status"],
    ]
    for log in logs:
        user_name = log.user.name if log.user else ""
        table_data.append([
            log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "",
            user_name,
            log.action,
            log.resource_type or "",
            str(log.resource_id) if log.resource_id else "",
            (log.description or "")[:80],
            log.ip_address,
            log.status,
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    elements.append(table)
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=audit_logs.pdf"})


