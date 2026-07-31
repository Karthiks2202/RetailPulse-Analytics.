from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional
from datetime import datetime
import csv
import io
from app.database import get_db
from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.sale import Sale, SaleItem, SaleStatus
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerListItem,
    CustomerPurchaseHistoryResponse,
    CustomerFrequentProductResponse,
    CustomerPurchaseDetailResponse,
    CustomerAnalyticsSummary,
    CustomerAnalyticsDashboardResponse,
    CustomerGrowthPoint,
    RevenueByTypePoint,
    LocationDistributionPoint,
    SpendingDistributionResponse,
    PurchaseFrequencyPoint,
    CustomerSegmentResponse,
    MonthlyAcquisitionPoint,
    CustomerDetailedProfileResponse,
    CustomerFavouriteResponse,
    CustomerTimelineResponse,
    TopCustomerResponse,
    NewVsReturningResponse,
)
from app.utils.dependencies import get_current_active_user
from app.services.audit import audit_service
from app.crud.customer import customer as customer_crud
from app.crud.notification import notification as notification_crud
from app.models.notification import NotificationType
from app.models.user import UserRole

router = APIRouter(prefix="/customers", tags=["customers"])


def is_admin(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)


async def _notify_company_admins(db: AsyncSession, company_id: UUID, title: str, message: str, notif_type: NotificationType = NotificationType.SYSTEM):
    await notification_crud.create(db=db, company_id=company_id, title=title, message=message, type=notif_type)


def serialize_customer(cust: Customer) -> CustomerResponse:
    return CustomerResponse(
        id=cust.id,
        company_id=cust.company_id,
        first_name=cust.first_name,
        last_name=cust.last_name,
        email=cust.email,
        phone=cust.phone,
        date_of_birth=cust.date_of_birth,
        gender=cust.gender,
        address=cust.address,
        city=cust.city,
        state=cust.state,
        postal_code=cust.postal_code,
        country=cust.country,
        customer_type=cust.customer_type,
        preferred_sales_channel=cust.preferred_sales_channel,
        notes=cust.notes,
        customer_since=cust.customer_since,
        status=cust.status,
        created_at=cust.created_at,
        updated_at=cust.updated_at,
    )


def serialize_customer_item(cust: Customer, purchases: int, spent: float, last_purchase: datetime | None) -> CustomerListItem:
    return CustomerListItem(
        id=cust.id,
        company_id=cust.company_id,
        first_name=cust.first_name,
        last_name=cust.last_name,
        email=cust.email,
        phone=cust.phone,
        city=cust.city,
        customer_type=cust.customer_type,
        preferred_sales_channel=cust.preferred_sales_channel,
        status=cust.status,
        total_purchases=purchases,
        total_spent=spent,
        last_purchase_date=last_purchase,
        customer_since=cust.customer_since,
    )


@router.get("", response_model=list[CustomerListItem])
async def list_customers(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    status: Optional[CustomerStatus] = Query(None),
    customer_type: Optional[CustomerType] = Query(None),
    city: str | None = Query(None),
    state: str | None = Query(None),
    country: str | None = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: str = Query("created_at", pattern="^(created_at|first_name|last_name|customer_type|total_spent|total_orders|last_purchase_date|customer_since|name)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    from datetime import datetime as dt
    parsed_from = dt.fromisoformat(date_from) if date_from else None
    parsed_to = dt.fromisoformat(date_to) if date_to else None

    customers, total = await customer_crud.list(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        customer_type=customer_type,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    result = []
    for cust in customers:
        if city and (cust.city or '').lower() != city.lower():
            continue
        if state and (cust.state or '').lower() != state.lower():
            continue
        if country and (cust.country or '').lower() != country.lower():
            continue
        if parsed_from and cust.customer_since < parsed_from:
            continue
        if parsed_to and cust.customer_since > parsed_to:
            continue
        summary = await customer_crud.get_purchase_summary(db, cust.id)
        result.append(serialize_customer_item(cust, summary["total_purchases"], summary["total_spent"], summary["last_purchase_date"]))
    return result


@router.get("/timeline", response_model=list[CustomerTimelineResponse])
async def list_company_timeline(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    action: str | None = Query(None),
    customer_id: UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
):
    from app.crud.customer_timeline import customer_timeline
    entries, _ = await customer_timeline.list_for_company(db, current_user.company_id, skip=skip, limit=limit, action=action, customer_id=customer_id)
    return [CustomerTimelineResponse(**entry.__dict__) for entry in entries]


@router.get("/{customer_id}/timeline", response_model=list[CustomerTimelineResponse])
async def list_customer_timeline(
    customer_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    from app.crud.customer_timeline import customer_timeline
    entries, _ = await customer_timeline.list_for_customer(db, current_user.company_id, customer_id, skip=skip, limit=limit)
    return [CustomerTimelineResponse(**entry.__dict__) for entry in entries]


@router.get("/analytics/summary", response_model=CustomerAnalyticsSummary)
async def get_customer_analytics_summary(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    total_result = await db.execute(
        select(func.count(Customer.id)).where(Customer.company_id == current_user.company_id)
    )
    total_customers = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(Customer.id)).where(Customer.company_id == current_user.company_id).where(Customer.status == CustomerStatus.ACTIVE)
    )
    active_customers = active_result.scalar() or 0

    inactive_customers = total_customers - active_customers

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_result = await db.execute(
        select(func.count(Customer.id)).where(Customer.company_id == current_user.company_id).where(Customer.customer_since >= month_start)
    )
    new_customers_this_month = new_result.scalar() or 0

    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Sale.total_amount), 0))
        .where(Sale.company_id == current_user.company_id)
        .where(Sale.status == SaleStatus.COMPLETED)
        .where(Sale.customer_id.is_not(None))
    )
    total_revenue = float(revenue_result.scalar() or 0)

    avg_spend = total_revenue / active_customers if active_customers > 0 else 0.0

    return CustomerAnalyticsSummary(
        total_customers=total_customers,
        active_customers=active_customers,
        inactive_customers=inactive_customers,
        new_customers_this_month=new_customers_this_month,
        total_revenue_from_customers=total_revenue,
        average_customer_spend=avg_spend,
    )


@router.get("/analytics/dashboard", response_model=CustomerAnalyticsDashboardResponse)
async def get_customer_analytics_dashboard(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await customer_crud.get_customer_analytics_dashboard(db, current_user.company_id)
    return CustomerAnalyticsDashboardResponse(**data)


@router.get("/analytics/growth", response_model=list[CustomerGrowthPoint])
async def get_customer_growth(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    months: int = Query(12, ge=1, le=36),
):
    data = await customer_crud.get_customer_growth(db, current_user.company_id, months)
    return [CustomerGrowthPoint(**row) for row in data]


@router.get("/analytics/revenue-by-type", response_model=list[RevenueByTypePoint])
async def get_revenue_by_customer_type(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await customer_crud.get_revenue_by_customer_type(db, current_user.company_id)
    return [RevenueByTypePoint(**row) for row in data]


@router.get("/analytics/location-distribution", response_model=list[LocationDistributionPoint])
async def get_location_distribution(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await customer_crud.get_location_distribution(db, current_user.company_id)
    return [LocationDistributionPoint(**row) for row in data]


@router.get("/analytics/spending-distribution", response_model=SpendingDistributionResponse)
async def get_spending_distribution(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await customer_crud.get_spending_distribution(db, current_user.company_id)
    return SpendingDistributionResponse(**data)


@router.get("/analytics/purchase-frequency", response_model=list[PurchaseFrequencyPoint])
async def get_purchase_frequency_distribution(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await customer_crud.get_purchase_frequency_distribution(db, current_user.company_id)
    return [PurchaseFrequencyPoint(**row) for row in data]


@router.get("/analytics/segmentation", response_model=CustomerSegmentResponse)
async def get_customer_segmentation(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await customer_crud.get_segmentation(db, current_user.company_id)
    return CustomerSegmentResponse(**data)


@router.get("/analytics/monthly-acquisition", response_model=list[MonthlyAcquisitionPoint])
async def get_monthly_acquisition(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    months: int = Query(12, ge=1, le=36),
):
    data = await customer_crud.get_monthly_acquisition(db, current_user.company_id, months)
    return [MonthlyAcquisitionPoint(**row) for row in data]


@router.get("/analytics/top", response_model=list[TopCustomerResponse])
async def get_top_customers(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    top = await customer_crud.get_top_customers(db, current_user.company_id, limit)
    return [TopCustomerResponse(**item) for item in top]


@router.get("/analytics/new-vs-returning", response_model=NewVsReturningResponse)
async def get_new_vs_returning(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    from datetime import datetime as dt
    parsed_from = dt.fromisoformat(date_from) if date_from else None
    parsed_to = dt.fromisoformat(date_to) if date_to else None
    data = await customer_crud.get_new_vs_returning(db, current_user.company_id, parsed_from, parsed_to)
    return NewVsReturningResponse(**data)


@router.get("/analytics/recent", response_model=list[dict])
async def get_recent_customers(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    return await customer_crud.get_recent_customers(db, current_user.company_id, limit)


@router.get("/analytics/revenue-contribution", response_model=list[dict])
async def get_customer_revenue_contribution(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    return await customer_crud.get_customer_revenue_contribution(db, current_user.company_id, limit)


@router.get("/export/csv")
async def export_customers_csv(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    status: Optional[CustomerStatus] = Query(None),
    customer_type: Optional[CustomerType] = Query(None),
    search: str | None = Query(None),
    request: Request = None,
):
    rows = await customer_crud.export_customers(db, current_user.company_id, status=status, customer_type=customer_type)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Exported", request, entity_name="Customers", details=f"Exported {len(rows)} customers as CSV")
    if not rows:
        return StreamingResponse(io.StringIO(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=customers.csv"})

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=customers.csv"})


@router.get("/export/pdf")
async def export_customers_pdf(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    status: Optional[CustomerStatus] = Query(None),
    customer_type: Optional[CustomerType] = Query(None),
    search: str | None = Query(None),
    request: Request = None,
):
    rows = await customer_crud.export_customers(db, current_user.company_id, status=status, customer_type=customer_type)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Exported", request, entity_name="Customers", details=f"Exported {len(rows)} customers as PDF")
    return {
        "content": rows,
        "filename": "customers.pdf",
        "content_type": "application/json",
        "message": "PDF data generated. Use frontend PDF library to render.",
    }


@router.get("/export/analytics/csv")
async def export_customer_analytics_csv(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    dashboard = await customer_crud.get_customer_analytics_dashboard(db, current_user.company_id)
    growth = await customer_crud.get_customer_growth(db, current_user.company_id)
    top = await customer_crud.get_top_customers(db, current_user.company_id)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Exported", request, entity_name="Customer Analytics", details="Exported customer analytics report as CSV")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Customers", dashboard.get("total_customers", 0)])
    writer.writerow(["Active Customers", dashboard.get("active_customers", 0)])
    writer.writerow(["New Customers", dashboard.get("new_customers", 0)])
    writer.writerow(["Returning Customers", dashboard.get("returning_customers", 0)])
    writer.writerow(["Total Revenue", dashboard.get("total_revenue", 0)])
    writer.writerow(["Average Customer Spend", dashboard.get("average_customer_spend", 0)])
    writer.writerow(["Average Purchase Frequency", dashboard.get("average_purchase_frequency", 0)])
    writer.writerow([])
    writer.writerow(["Month", "New Customers"])
    for row in growth:
        writer.writerow([row.get("month"), row.get("new_customers")])
    writer.writerow([])
    writer.writerow(["Top Customers"])
    writer.writerow(["Name", "Total Purchases", "Total Spent", "Last Purchase"])
    for row in top:
        writer.writerow([f"{row.get('first_name', '')} {row.get('last_name', '')}", row.get("total_purchases", 0), row.get("total_spent", 0), row.get("last_purchase_date")])

    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=customer_analytics_report.csv"})


@router.get("/export/analytics/pdf")
async def export_customer_analytics_pdf(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    dashboard = await customer_crud.get_customer_analytics_dashboard(db, current_user.company_id)
    growth = await customer_crud.get_customer_growth(db, current_user.company_id)
    top = await customer_crud.get_top_customers(db, current_user.company_id)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Exported", request, entity_name="Customer Analytics", details="Exported customer analytics report as PDF")
    return {
        "content": {"dashboard": dashboard, "growth": growth, "top": top},
        "filename": "customer_analytics_report.pdf",
        "content_type": "application/json",
        "message": "PDF data generated. Use frontend PDF library to render.",
    }


@router.get("/export/top/csv")
async def export_top_customers_csv(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    top = await customer_crud.get_top_customers(db, current_user.company_id)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Exported", request, entity_name="Top Customers", details=f"Exported top {len(top)} customers as CSV")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Email", "Total Purchases", "Total Spent", "Last Purchase"])
    for row in top:
        writer.writerow([f"{row.get('first_name', '')} {row.get('last_name', '')}", row.get("email", ""), row.get("total_purchases", 0), row.get("total_spent", 0), row.get("last_purchase_date")])

    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=top_customers_report.csv"})


@router.get("/export/top/pdf")
async def export_top_customers_pdf(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    top = await customer_crud.get_top_customers(db, current_user.company_id)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Exported", request, entity_name="Top Customers", details=f"Exported top {len(top)} customers as PDF")
    return {
        "content": top,
        "filename": "top_customers_report.pdf",
        "content_type": "application/json",
        "message": "PDF data generated. Use frontend PDF library to render.",
    }

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    summary = await customer_crud.get_purchase_summary(db, cust.id)
    response = serialize_customer(cust)
    response.total_purchases = summary["total_purchases"]
    response.total_spent = summary["total_spent"]
    response.last_purchase_date = summary["last_purchase_date"]
    return response


@router.get("/{customer_id}/profile", response_model=CustomerDetailedProfileResponse)
async def get_customer_profile(
    customer_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = await customer_crud.get_detailed_profile(db, customer_id)

    total_orders = data.get("total_orders", 0)
    total_revenue = data.get("total_revenue", 0)
    last_purchase_date = data.get("last_purchase_date")

    if total_orders >= 10 and total_revenue >= 5000:
        await _notify_company_admins(db, current_user.company_id, title="VIP Customer", message=f"Customer '{cust.first_name} {cust.last_name}' has reached VIP status with {total_orders} orders and ${total_revenue:.2f} spent.", notif_type=NotificationType.VIP_STATUS)

    if last_purchase_date is None or (datetime.utcnow() - last_purchase_date).days > 90:
        await _notify_company_admins(db, current_user.company_id, title="Inactive Customer", message=f"Customer '{cust.first_name} {cust.last_name}' has been inactive for over 90 days.", notif_type=NotificationType.CUSTOMER_INACTIVE)

    return CustomerDetailedProfileResponse(**data)


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.email:
        existing = await customer_crud.get_by_email(db, current_user.company_id, payload.email)
        if existing:
            raise HTTPException(status_code=400, detail="A customer with this email already exists")

    if payload.phone:
        existing_phone = await customer_crud.get_by_phone(db, current_user.company_id, payload.phone)
        if existing_phone:
            raise HTTPException(status_code=400, detail="A customer with this phone number already exists")

    cust = await customer_crud.create(
        db,
        current_user.company_id,
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.phone,
        payload.date_of_birth,
        payload.gender,
        payload.address,
        payload.city,
        payload.state,
        payload.country,
        payload.postal_code,
        payload.customer_type.value if hasattr(payload.customer_type, "value") else payload.customer_type,
        payload.preferred_sales_channel,
        payload.notes,
        payload.status.value if hasattr(payload.status, "value") else payload.status,
    )
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Created", request, entity_name=f"{cust.first_name} {cust.last_name}", details=f"Created customer '{cust.first_name} {cust.last_name}'")
    await _notify_company_admins(db, current_user.company_id, title="New Customer Registered", message=f"New customer '{cust.first_name} {cust.last_name}' has been registered.", notif_type=NotificationType.CUSTOMER_REGISTERED)
    return serialize_customer(cust)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    payload: CustomerUpdate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] and update_data["email"] != cust.email:
        existing = await customer_crud.get_by_email(db, current_user.company_id, update_data["email"])
        if existing and existing.id != customer_id:
            raise HTTPException(status_code=400, detail="A customer with this email already exists")

    if "phone" in update_data and update_data["phone"] and update_data["phone"] != cust.phone:
        existing_phone = await customer_crud.get_by_phone(db, current_user.company_id, update_data["phone"])
        if existing_phone and existing_phone.id != customer_id:
            raise HTTPException(status_code=400, detail="A customer with this phone number already exists")

    if "customer_type" in update_data and hasattr(update_data["customer_type"], "value"):
        update_data["customer_type"] = update_data["customer_type"].value
    if "status" in update_data and hasattr(update_data["status"], "value"):
        update_data["status"] = update_data["status"].value

    updated = await customer_crud.update(db, cust, **update_data)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Updated", request, entity_name=f"{updated.first_name} {updated.last_name}", details=f"Updated customer '{updated.first_name} {updated.last_name}'")
    await customer_crud.log_timeline(db, current_user.company_id, customer_id, current_user.id, "Profile Updated", f"Updated customer '{updated.first_name} {updated.last_name}'")
    return serialize_customer(updated)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        await customer_crud.delete(db, cust)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Deleted", request, entity_name=f"{cust.first_name} {cust.last_name}", details=f"Deleted customer '{cust.first_name} {cust.last_name}'")


@router.patch("/{customer_id}/activate", response_model=CustomerResponse)
async def activate_customer(
    customer_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    updated = await customer_crud.update(db, cust, status=CustomerStatus.ACTIVE.value)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Activated", request, entity_name=f"{updated.first_name} {updated.last_name}", details=f"Activated customer '{updated.first_name} {updated.last_name}'")
    await customer_crud.log_timeline(db, current_user.company_id, customer_id, current_user.id, "Reactivated", f"Reactivated customer '{updated.first_name} {updated.last_name}'")
    return serialize_customer(updated)


@router.patch("/{customer_id}/deactivate", response_model=CustomerResponse)
async def deactivate_customer(
    customer_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    updated = await customer_crud.update(db, cust, status=CustomerStatus.INACTIVE.value)
    await audit_service.log(db, current_user.company_id, current_user.id, "Customer Deactivated", request, entity_name=f"{updated.first_name} {updated.last_name}", details=f"Deactivated customer '{updated.first_name} {updated.last_name}'")
    await customer_crud.log_timeline(db, current_user.company_id, customer_id, current_user.id, "Deactivated", f"Deactivated customer '{updated.first_name} {updated.last_name}'")
    return serialize_customer(updated)


@router.get("/{customer_id}/purchase-history", response_model=list[CustomerPurchaseHistoryResponse])
async def get_customer_purchase_history(
    customer_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    sales, _ = await customer_crud.get_purchase_history(db, customer_id, skip=skip, limit=limit)
    result = []
    for sale in sales:
        item_count = len(sale.items) if sale.items else 0
        result.append(CustomerPurchaseHistoryResponse(
            id=sale.id,
            invoice_number=sale.invoice_number,
            sale_date=sale.sale_date,
            sales_channel=sale.sales_channel.value if hasattr(sale.sales_channel, "value") else str(sale.sales_channel),
            payment_method=sale.payment_method.value if hasattr(sale.payment_method, "value") else str(sale.payment_method),
            total_amount=float(sale.total_amount),
            status=sale.status.value if hasattr(sale.status, "value") else str(sale.status),
            item_count=item_count,
        ))
    return result


@router.get("/{customer_id}/purchase-detail", response_model=CustomerPurchaseDetailResponse)
async def get_customer_purchase_detail(
    customer_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    recent_limit: int = Query(10, ge=1, le=50),
    top_products_limit: int = Query(5, ge=1, le=20),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    detail = await customer_crud.get_purchase_detail(db, customer_id, recent_limit=recent_limit, top_products_limit=top_products_limit)
    return CustomerPurchaseDetailResponse(
        total_orders=detail["total_orders"],
        total_revenue=detail["total_revenue"],
        total_quantity_purchased=detail["total_quantity_purchased"],
        average_order_value=detail["average_order_value"],
        first_purchase_date=detail["first_purchase_date"],
        last_purchase_date=detail["last_purchase_date"],
        frequently_purchased_products=[
            CustomerFrequentProductResponse(**item) for item in detail["frequently_purchased_products"]
        ],
        recent_transactions=[
            CustomerPurchaseHistoryResponse(**item) for item in detail["recent_transactions"]
        ],
    )


@router.get("/{customer_id}/lifetime-value", response_model=dict)
async def get_customer_lifetime_value(
    customer_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cust = await customer_crud.get(db, customer_id)
    if not cust or cust.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")

    ltv = await customer_crud.get_customer_lifetime_value(db, customer_id)
    return ltv
