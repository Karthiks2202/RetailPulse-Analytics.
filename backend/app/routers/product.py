from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import Optional
from app.database import get_db
from app.models.product import Product, ProductStatus
from app.models.category import Category
from app.models.sale import SaleItem
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.schemas.category import CategoryResponse
from app.utils.dependencies import get_current_active_user
from app.services.audit import audit_service
from app.crud.product import product as product_crud
from app.crud.category import category as category_crud

router = APIRouter(prefix="/products", tags=["products"])

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
        low_stock_threshold=prod.low_stock_threshold,
        unit_of_measure=prod.unit_of_measure,
        status=prod.status,
        created_at=prod.created_at,
        updated_at=prod.updated_at,
        category=cat_resp,
    )

@router.get("", response_model=list[ProductResponse])
async def list_products(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    category_id: UUID | None = Query(None),
    status: Optional[ProductStatus] = Query(None),
    brand: str | None = Query(None),
    sort_by: str = Query("created_at", pattern="^(name|unit_price|created_at)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    products, total = await product_crud.list(
        db,
        current_user.company_id,
        skip=skip,
        limit=limit,
        search=search,
        category_id=category_id,
        status=status,
        brand=brand,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    result = []
    for prod in products:
        cat = None
        if prod.category_id:
            cat = await category_crud.get(db, prod.category_id)
        result.append(serialize_product(prod, cat))
    return result

@router.get("/active", response_model=list[ProductResponse])
async def list_active_products(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    category_id: UUID | None = Query(None),
    search: str | None = Query(None),
):
    # Sales / transaction entry screens must only expose ACTIVE products
    # and never cross company boundaries.
    products, _ = await product_crud.list(
        db,
        current_user.company_id,
        category_id=category_id,
        search=search,
        status=ProductStatus.ACTIVE,
        sort_by="name",
        sort_dir="asc",
    )
    result = []
    for prod in products:
        cat = None
        if prod.category_id:
            cat = await category_crud.get(db, prod.category_id)
        result.append(serialize_product(prod, cat))
    return result


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    prod = await product_crud.get(db, product_id)
    if not prod or prod.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Product not found")

    cat = None
    if prod.category_id:
        cat = await category_crud.get(db, prod.category_id)
    return serialize_product(prod, cat)

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.cost_price > payload.unit_price:
        raise HTTPException(status_code=400, detail="Cost price cannot exceed unit price")

    sku_check = await product_crud.get_by_sku(db, current_user.company_id, payload.sku)
    if sku_check:
        raise HTTPException(status_code=400, detail="SKU already exists in your company")

    name_check = await product_crud.get_by_name_in_category(db, current_user.company_id, payload.name, payload.category_id)
    if name_check:
        raise HTTPException(status_code=400, detail="Product with this name already exists in the selected category")

    if payload.category_id:
        cat = await category_crud.get(db, payload.category_id)
        if not cat or cat.company_id != current_user.company_id:
            raise HTTPException(status_code=400, detail="Invalid category")

    prod = await product_crud.create(
        db,
        current_user.company_id,
        payload.name,
        payload.sku,
        payload.category_id,
        payload.brand,
        payload.description,
        float(payload.unit_price),
        float(payload.cost_price),
        payload.stock_quantity,
        payload.low_stock_threshold,
        payload.unit_of_measure.value if hasattr(payload.unit_of_measure, 'value') else payload.unit_of_measure,
        payload.status.value if hasattr(payload.status, 'value') else payload.status,
    )
    await audit_service.log(db, current_user.company_id, current_user.id, "Product Created", request, entity_name=prod.name, details=f"Created product '{prod.name}' with SKU {prod.sku}")
    cat = await category_crud.get(db, prod.category_id) if prod.category_id else None
    return serialize_product(prod, cat)

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    prod = await product_crud.get(db, product_id)
    if not prod or prod.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "cost_price" in update_data and "unit_price" in update_data:
        if update_data["cost_price"] > update_data["unit_price"]:
            raise HTTPException(status_code=400, detail="Cost price cannot exceed unit price")
    elif "cost_price" in update_data and update_data["cost_price"] > float(prod.unit_price):
        raise HTTPException(status_code=400, detail="Cost price cannot exceed unit price")
    elif "unit_price" in update_data and float(prod.cost_price) > update_data["unit_price"]:
        raise HTTPException(status_code=400, detail="Cost price cannot exceed unit price")

    if "sku" in update_data and update_data["sku"] != prod.sku:
        sku_check = await product_crud.get_by_sku(db, current_user.company_id, update_data["sku"])
        if sku_check:
            raise HTTPException(status_code=400, detail="SKU already exists in your company")

    target_category_id = update_data.get("category_id", prod.category_id)
    if "name" in update_data:
        name_check = await product_crud.get_by_name_in_category(db, current_user.company_id, update_data["name"], target_category_id)
        if name_check and name_check.id != product_id:
            raise HTTPException(status_code=400, detail="Product with this name already exists in the selected category")

    if "category_id" in update_data and update_data["category_id"]:
        cat = await category_crud.get(db, update_data["category_id"])
        if not cat or cat.company_id != current_user.company_id:
            raise HTTPException(status_code=400, detail="Invalid category")

    updated = await product_crud.update(db, prod, **update_data)
    await audit_service.log(db, current_user.company_id, current_user.id, "Product Updated", request, entity_name=updated.name, details=f"Updated product '{updated.name}'")
    cat = await category_crud.get(db, updated.category_id) if updated.category_id else None
    return serialize_product(updated, cat)

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    prod = await product_crud.get(db, product_id)
    if not prod or prod.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Product not found")

    try:
        await product_crud.delete(db, prod)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await audit_service.log(db, current_user.company_id, current_user.id, "Product Deleted", request, entity_name=prod.name, details=f"Deleted product '{prod.name}'")

@router.patch("/{product_id}/activate", response_model=ProductResponse)
async def activate_product(
    product_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    prod = await product_crud.get(db, product_id)
    if not prod or prod.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Product not found")

    updated = await product_crud.update(db, prod, status=ProductStatus.ACTIVE.value)
    await audit_service.log(db, current_user.company_id, current_user.id, "Product Activated", request, entity_name=updated.name, details=f"Activated product '{updated.name}'")
    cat = await category_crud.get(db, updated.category_id) if updated.category_id else None
    return serialize_product(updated, cat)

@router.patch("/{product_id}/deactivate", response_model=ProductResponse)
async def deactivate_product(
    product_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    prod = await product_crud.get(db, product_id)
    if not prod or prod.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Product not found")

    updated = await product_crud.update(db, prod, status=ProductStatus.INACTIVE.value)
    await audit_service.log(db, current_user.company_id, current_user.id, "Product Deactivated", request, entity_name=updated.name, details=f"Deactivated product '{updated.name}'")
    cat = await category_crud.get(db, updated.category_id) if updated.category_id else None
    return serialize_product(updated, cat)
