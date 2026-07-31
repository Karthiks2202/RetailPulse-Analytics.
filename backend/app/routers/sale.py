from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.sale import Sale, SaleStatus
from app.models.product import Product
from app.models.category import Category
from app.schemas.sale import SaleCreate, SaleUpdate, SaleResponse, SaleListItemResponse, SaleSummaryResponse, SaleItemResponse
from app.schemas.category import CategoryResponse
from app.schemas.product import ProductResponse
from app.utils.dependencies import get_current_active_user
from app.crud.sale import sale as sale_crud
from app.crud.category import category as category_crud
from app.crud.product import product as product_crud

router = APIRouter(prefix="/sales", tags=["sales"])


def serialize_product(prod: Product, category: Category | None = None) -> ProductResponse:
    cat_resp = None
    if category:
        cat_resp = CategoryResponse(
            id=category.id,
            company_id=category.company_id,
            name=category.name,
            description=category.description,
            status=category.status,
            created_at=category.created_at,
            updated_at=category.updated_at,
            product_count=0,
        )
    return ProductResponse(
        id=prod.id,
        company_id=prod.company_id,
        name=prod.name,
        sku=prod.sku,
        category_id=prod.category_id,
        brand=prod.brand,
        description=prod.description,
        unit_price=float(prod.unit_price),
        cost_price=float(prod.cost_price),
        stock_quantity=prod.stock_quantity,
        unit_of_measure=prod.unit_of_measure,
        status=prod.status,
        created_at=prod.created_at,
        updated_at=prod.updated_at,
        category=cat_resp,
    )


@router.get("", response_model=list[SaleListItemResponse])
async def list_sales(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    customer_name: str | None = Query(None),
    product_name: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    sales_channel: str | None = Query(None),
    payment_method: str | None = Query(None),
    category_id: UUID | None = Query(None),
    sort_by: str = Query("created_at", pattern="^(created_at|invoice_number|total_amount|sale_date)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    sales, total = await sale_crud.list_with_items(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
        search=search,
        customer_name=customer_name,
        product_name=product_name,
        date_from=date_from,
        date_to=date_to,
        sales_channel=sales_channel,
        payment_method=payment_method,
        category_id=category_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    result = []
    for s in sales:
        result.append(SaleListItemResponse(
            id=s.id,
            company_id=s.company_id,
            invoice_number=s.invoice_number,
            customer_name=s.customer_name,
            sale_date=s.sale_date,
            sales_channel=s.sales_channel,
            payment_method=s.payment_method,
            total_amount=float(s.total_amount),
            status=s.status,
            item_count=len(s.items) if s.items else 0,
            created_at=s.created_at,
            updated_at=s.updated_at,
        ))
    return result


@router.get("/summary", response_model=SaleSummaryResponse)
async def get_sales_summary(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await sale_crud.get_summary(db, current_user.company_id)
    return SaleSummaryResponse(**summary)


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    sale = await sale_crud.get(db, sale_id)
    if not sale or sale.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Sale not found")

    await db.refresh(sale, attribute_names=["items"])
    items = []
    for item in sale.items:
        prod = None
        cat = None
        if item.product_id:
            prod = await product_crud.get(db, item.product_id)
        if item.category_id:
            cat = await category_crud.get(db, item.category_id)
        prod_resp = serialize_product(prod, cat) if prod else None
        items.append(SaleItemResponse(
            id=item.id,
            sale_id=item.sale_id,
            product_id=item.product_id,
            category_id=item.category_id,
            quantity=item.quantity,
            unit_price=float(item.unit_price),
            discount=float(item.discount),
            tax=float(item.tax),
            total=float(item.total),
            product=prod_resp,
            category=None,
        ))

    return SaleResponse(
        id=sale.id,
        company_id=sale.company_id,
        invoice_number=sale.invoice_number,
        customer_name=sale.customer_name,
        sale_date=sale.sale_date,
        sales_channel=sale.sales_channel,
        payment_method=sale.payment_method,
        total_amount=float(sale.total_amount),
        status=sale.status,
        created_by=sale.created_by,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=items,
    )


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    payload: SaleCreate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    allowed_roles = ["COMPANY_ADMIN", "ANALYST"]
    if current_user.role.value not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    items = [item.model_dump() for item in payload.items]
    sale = await sale_crud.create(
        db,
        current_user.company_id,
        current_user.id,
        payload.customer_name,
        payload.sale_date or datetime.utcnow(),
        payload.sales_channel.value,
        payload.payment_method.value,
        items,
        request,
        payload.customer_id,
    )
    return await get_sale(sale.id, current_user, db)


@router.put("/{sale_id}", response_model=SaleResponse)
async def update_sale(
    sale_id: UUID,
    payload: SaleUpdate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    allowed_roles = ["COMPANY_ADMIN", "ANALYST"]
    if current_user.role.value not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    update_data = payload.model_dump(exclude_unset=True)
    items = update_data.pop("items", None)

    if items is not None:
        update_data["items"] = items

    sale = await sale_crud.update(db, sale_id, current_user.company_id, current_user.id, update_data, request)
    return await get_sale(sale.id, current_user, db)


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sale(
    sale_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    allowed_roles = ["COMPANY_ADMIN", "ANALYST"]
    if current_user.role.value not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    await sale_crud.delete(db, sale_id, current_user.company_id, current_user.id, request)
