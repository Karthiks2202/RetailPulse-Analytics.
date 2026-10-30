from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.user import UserRole
from app.schemas.data_quality import (
    DataQualityIssueResponse,
    DataQualityIssueListResponse,
    DataQualityIssueUpdate,
    ReconciliationRunResponse,
    ReconciliationRunListResponse,
    DataQualityDashboard,
    ReconcileRequest,
    ReconcileResult,
)
from app.utils.dependencies import get_current_active_user
from app.crud import data_quality_issue_crud as dq_issue_crud, reconciliation_run_crud as dq_run_crud
from app.services.data_quality import data_quality_service
from app.services.audit import audit_service

router = APIRouter(prefix="/data-quality", tags=["data-quality"])


def is_admin_or_analyst(user) -> bool:
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN)


@router.get("/dashboard", response_model=DataQualityDashboard)
async def get_dashboard(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    stats = await data_quality_service.get_dashboard_stats(db, current_user.company_id)
    return DataQualityDashboard(**stats)


@router.get("/issues", response_model=DataQualityIssueListResponse)
async def list_issues(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    issue_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    items, total = await dq_issue_crud.get_multi(
        db,
        company_id=current_user.company_id,
        page=page,
        page_size=page_size,
        issue_type=issue_type,
        severity=severity,
        module=module,
        status=status,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )

    return DataQualityIssueListResponse(
        items=[DataQualityIssueResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/issues/{issue_id}", response_model=DataQualityIssueResponse)
async def get_issue(
    issue_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    issue = await dq_issue_crud.get(db, issue_id, current_user.company_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    return DataQualityIssueResponse.model_validate(issue)


@router.put("/issues/{issue_id}/status", response_model=DataQualityIssueResponse)
async def update_issue_status(
    issue_id: UUID,
    payload: DataQualityIssueUpdate,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    # Ensure we pass resolved_by when resolving if not provided
    if payload.status == DataQualityIssueStatus.RESOLVED and payload.resolved_by is None:
        payload.resolved_by = current_user.id

    issue = await dq_issue_crud.update_status(
        db, issue_id, current_user.company_id, payload
    )
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    if request:
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Data Quality Issue Status Updated",
            request,
            resource_type="DataQualityIssue",
            resource_id=issue_id,
            description=f"Updated issue status to {payload.status.value if payload.status else 'unchanged'}; note: {payload.resolution_note or ''}",
            before_values={"previous_status": issue.previous_status},
            after_values={"status": issue.status.value, "resolution_note": issue.resolution_note},
        )

    return DataQualityIssueResponse.model_validate(issue)


@router.post("/reconcile", response_model=ReconcileResult)
async def trigger_reconciliation(
    payload: Optional[ReconcileRequest] = None,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    target_company_id = (payload.company_id if payload and payload.company_id else current_user.company_id)
    if target_company_id != current_user.company_id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot reconcile another company's data")

    target_triggered_by = (payload.triggered_by if payload and payload.triggered_by else current_user.id)

    result = await data_quality_service.run_reconciliation(
        db,
        company_id=target_company_id,
        triggered_by=target_triggered_by,
        request=request,
    )

    return ReconcileResult(**result)


@router.get("/reconciliation-runs", response_model=ReconciliationRunListResponse)
async def list_reconciliation_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    items, total = await dq_run_crud.get_multi(
        db,
        company_id=current_user.company_id,
        page=page,
        page_size=page_size,
    )

    return ReconciliationRunListResponse(
        items=[ReconciliationRunResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
