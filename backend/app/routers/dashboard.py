from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from app.database import get_db
from app.models.user import User
from app.models.product import Product, ProductStatus
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.schemas.dashboard import DashboardOverview, MonthlyRevenue, ChannelBreakdown
from app.utils.dependencies import get_current_active_user
from datetime import datetime, timedelta
from decimal import Decimal

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/overview", response_model=DashboardOverview)
async def get_dashboard_overview(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    team_result = await db.execute(select(User).where(User.company_id == current_user.company_id))
    team_count = len(team_result.scalars().all())

    product_result = await db.execute(select(func.count(Product.id)).where(Product.company_id == current_user.company_id))
    product_count = product_result.scalar() or 0

    active_product_result = await db.execute(select(func.count(Product.id)).where(Product.company_id == current_user.company_id).where(Product.status == ProductStatus.ACTIVE))
    active_product_count = active_product_result.scalar() or 0

    inactive_product_count = product_count - active_product_count

    category_result = await db.execute(select(func.count(Category.id)).where(Category.company_id == current_user.company_id))
    category_count = category_result.scalar() or 0

    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.company_id == current_user.company_id)
        .where(Transaction.type == TransactionType.SALE)
    )
    total_revenue = float(revenue_result.scalar() or 0)

    now = datetime.utcnow()
    months = []
    for i in range(5, -1, -1):
        month_date = now - timedelta(days=30 * i)
        month_name = month_date.strftime("%b")
        month_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            month_end = now
        else:
            next_month = month_date.replace(day=28) + timedelta(days=4)
            month_end = next_month.replace(day=1)

        monthly_revenue_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.company_id == current_user.company_id)
            .where(Transaction.type == TransactionType.SALE)
            .where(Transaction.created_at >= month_start)
            .where(Transaction.created_at < month_end)
        )
        monthly_revenue = float(monthly_revenue_result.scalar() or 0)
        months.append({"month": month_name, "revenue": monthly_revenue})

    channel_data = []
    for channel in ["Departmental POS", "Online Storefront", "Express Kiosks"]:
        channel_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.company_id == current_user.company_id)
            .where(Transaction.type == TransactionType.SALE)
            .where(Transaction.channel == channel)
        )
        channel_amount = float(channel_result.scalar() or 0)
        channel_data.append({"name": channel, "amount": channel_amount})

    total_channel = sum(c["amount"] for c in channel_data) or 1
    channel_breakdown = []
    for c in channel_data:
        percentage = int((c["amount"] / total_channel) * 100)
        channel_breakdown.append({
            "name": c["name"],
            "percentage": percentage,
            "value": f"${c['amount']:,.2f}"
        })

    return DashboardOverview(
        team_count=team_count,
        product_count=product_count,
        total_revenue=total_revenue,
        service_status="Operational",
        monthly_revenue=[MonthlyRevenue(**m) for m in months],
        channel_breakdown=[ChannelBreakdown(**c) for c in channel_breakdown],
        active_product_count=active_product_count,
        inactive_product_count=inactive_product_count,
        category_count=category_count,
    )
