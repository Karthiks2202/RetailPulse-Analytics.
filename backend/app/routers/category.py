from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.database import get_db
from app.models.category import Category, CategoryStatus
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.schemas.product import ProductResponse
from app.utils.dependencies import get_current_active_user
from app.services.audit import audit_service
from app.crud.category import category as category_crud
from app.crud.product import product as product_crud

router = APIRouter(prefix="/categories", tags=["categories"])

def serialize_category(cat: Category, product_count: int) -> CategoryResponse:
    return CategoryResponse(
        id=cat.id,
        company_id=cat.company_id,
        name=cat.name,
        description=cat.description,
        status=cat.status,
        created_at=cat.created_at,
        updated_at=cat.updated_at,
        product_count=product_count,
    )

@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    cats, total = await category_crud.list(db, current_user.company_id, skip=skip, limit=limit, search=search)
    result = []
    for cat in cats:
        count = await category_crud.count_products(db, cat.id)
        result.append(serialize_category(cat, count))
    return result

@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cat = await category_crud.get(db, category_id)
    if not cat or cat.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Category not found")
    count = await category_crud.count_products(db, category_id)
    return serialize_category(cat, count)

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await category_crud.get_by_name(db, current_user.company_id, payload.name)
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")

    cat = await category_crud.create(db, current_user.company_id, payload.name, payload.description, payload.status.value)
    await audit_service.log(db, current_user.company_id, current_user.id, "Category Created", request, entity_name=cat.name, details=f"Created category '{cat.name}'")
    count = await category_crud.count_products(db, cat.id)
    return serialize_category(cat, count)

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cat = await category_crud.get(db, category_id)
    if not cat or cat.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name:
        existing = await category_crud.get_by_name(db, current_user.company_id, payload.name)
        if existing and existing.id != category_id:
            raise HTTPException(status_code=400, detail="Category with this name already exists")

    updated = await category_crud.update(db, cat, payload.name, payload.description, payload.status.value if payload.status else None)
    await audit_service.log(db, current_user.company_id, current_user.id, "Category Updated", request, entity_name=updated.name, details=f"Updated category '{updated.name}'")
    count = await category_crud.count_products(db, category_id)
    return serialize_category(updated, count)

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cat = await category_crud.get(db, category_id)
    if not cat or cat.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Category not found")

    products_check = await db.execute(select(Product).where(Product.category_id == category_id).limit(1))
    if products_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot delete category with products. Remove products first.")

    await category_crud.delete(db, cat)
    await audit_service.log(db, current_user.company_id, current_user.id, "Category Deleted", request, entity_name=cat.name, details=f"Deleted category '{cat.name}'")
