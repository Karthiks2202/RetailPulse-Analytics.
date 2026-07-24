from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import UserRole
from app.models.notification import NotificationType
from app.schemas.inventory import (
    InventoryItemResponse,
    InventorySummary,
    InventoryCategoryBreakdown,
    InventoryStockStatusBreakdown,
    InventoryAdjustmentCreate,
    InventoryAdjustmentResponse,
    StockMovementResponse,
    ReorderLevelUpdate,
)
from app.utils.dependencies import get_current_active_user
from app.crud.inventory import inventory as inventory_crud
from app.crud.notification import notification as notification_crud
from app.services.audit import audit_service
from uuid import UUID


router = APIRouter(prefix="/inventory", tags=["inventory"])


def is_admin_or_analyst(user):
    return user.role in (UserRole.COMPANY_ADMIN, UserRole.ANALYST, UserRole.SUPER_ADMIN)


def get_status(available: int, threshold: int) -> str:
    if available == 0:
        return "OUT_OF_STOCK"
    elif available <= threshold:
        return "LOW_STOCK"
    return "IN_STOCK"


async def _create_notification(db: AsyncSession, company_id: UUID, title: str, message: str, notif_type: NotificationType = NotificationType.LOW_STOCK):
    await notification_crud.create(
        db=db,
        company_id=company_id,
        title=title,
        message=message,
        type=notif_type,
    )


@router.get("", response_model=list[InventoryItemResponse])
async def list_inventory(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    category_id: UUID | None = Query(None),
    stock_status: str | None = Query(None),
    brand: str | None = Query(None),
    sort_by: str = Query("name", pattern="^(name|current_stock|recently_updated)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    items = await inventory_crud.get_inventory_items(
        db,
        current_user.company_id,
        search=search,
        category_id=category_id,
        stock_status=stock_status,
        brand=brand,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return [InventoryItemResponse(**item) for item in items]


@router.get("/summary", response_model=InventorySummary)
async def get_inventory_summary(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    summary = await inventory_crud.get_inventory_summary(db, current_user.company_id)
    return InventorySummary(**summary)


@router.get("/category-breakdown", response_model=list[InventoryCategoryBreakdown])
async def get_category_breakdown(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    data = await inventory_crud.get_category_breakdown(db, current_user.company_id)
    return [InventoryCategoryBreakdown(**item) for item in data]


@router.get("/status-breakdown", response_model=list[InventoryStockStatusBreakdown])
async def get_status_breakdown(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    data = await inventory_crud.get_stock_status_breakdown(db, current_user.company_id)
    return [InventoryStockStatusBreakdown(**item) for item in data]


@router.get("/movements", response_model=list[StockMovementResponse])
async def get_stock_movements(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    product_id: UUID | None = Query(None),
    movement_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    if not is_admin_or_analyst(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    movements, total = await inventory_crud.get_stock_movements(
        db,
        current_user.company_id,
        product_id=product_id,
        movement_type=movement_type,
        skip=skip,
        limit=limit,
    )
    result = []
    for m in movements:
        data = {
            "id": m.id,
            "company_id": m.company_id,
            "product_id": m.product_id,
            "movement_type": m.movement_type,
            "previous_quantity": m.previous_quantity,
            "updated_quantity": m.updated_quantity,
            "quantity_changed": m.quantity_changed,
            "reason": m.reason,
            "user_id": m.user_id,
            "created_at": m.created_at,
            "product_name": m.product.name if m.product else None,
            "product_sku": m.product.sku if m.product else None,
        }
        result.append(StockMovementResponse(**data))
    return result


@router.get("/adjustments", response_model=list[InventoryAdjustmentResponse])
async def get_adjustments(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    product_id: UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    adjustments, total = await inventory_crud.get_adjustments(
        db,
        current_user.company_id,
        product_id=product_id,
        skip=skip,
        limit=limit,
    )
    result = []
    for a in adjustments:
        data = {
            "id": a.id,
            "company_id": a.company_id,
            "product_id": a.product_id,
            "adjustment_type": a.adjustment_type,
            "quantity": a.quantity,
            "reason": a.reason,
            "remarks": a.remarks,
            "adjusted_by": a.adjusted_by,
            "adjusted_at": a.adjusted_at,
            "product_name": a.product.name if a.product else None,
            "product_sku": a.product.sku if a.product else None,
        }
        result.append(InventoryAdjustmentResponse(**data))
    return result


@router.post("/add-stock", response_model=InventoryItemResponse)
async def add_stock(
    payload: InventoryAdjustmentCreate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive for stock addition")

    try:
        product = await inventory_crud.add_stock(
            db,
            current_user.company_id,
            payload.product_id,
            payload.quantity,
            current_user.id,
            reason=payload.reason,
            remarks=payload.remarks,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Stock Added",
        request,
        entity_name=product.name,
        details=f"Added {payload.quantity} units of '{product.name}'",
    )

    available = product.stock_quantity - product.reserved_stock
    stock_status = get_status(available, product.low_stock_threshold)

    if stock_status == "LOW_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Low Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) has reached low stock level. Available: {available}, Threshold: {product.low_stock_threshold}",
            NotificationType.LOW_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Reached Low Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' reached low stock after stock addition. Available: {available}",
        )
    elif stock_status == "OUT_OF_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Out of Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) is now out of stock.",
            NotificationType.OUT_OF_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Became Out of Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' became out of stock after stock addition.",
        )

    await db.commit()

    return InventoryItemResponse(
        id=product.id,
        company_id=product.company_id,
        name=product.name,
        sku=product.sku,
        category_id=product.category_id,
        brand=product.brand,
        description=product.description,
        unit_price=float(product.unit_price),
        cost_price=float(product.cost_price),
        stock_quantity=product.stock_quantity,
        reserved_stock=product.reserved_stock,
        available_stock=available,
        low_stock_threshold=product.low_stock_threshold,
        stock_status=stock_status,
        unit_of_measure=product.unit_of_measure.value,
    )


@router.post("/remove-stock", response_model=InventoryItemResponse)
async def remove_stock(
    payload: InventoryAdjustmentCreate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive for stock removal")

    try:
        product = await inventory_crud.remove_stock(
            db,
            current_user.company_id,
            payload.product_id,
            payload.quantity,
            current_user.id,
            reason=payload.reason,
            remarks=payload.remarks,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Stock Removed",
        request,
        entity_name=product.name,
        details=f"Removed {payload.quantity} units of '{product.name}'",
    )

    available = product.stock_quantity - product.reserved_stock
    stock_status = get_status(available, product.low_stock_threshold)

    if stock_status == "LOW_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Low Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) has reached low stock level. Available: {available}, Threshold: {product.low_stock_threshold}",
            NotificationType.LOW_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Reached Low Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' reached low stock after stock removal. Available: {available}",
        )
    elif stock_status == "OUT_OF_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Out of Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) is now out of stock.",
            NotificationType.OUT_OF_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Became Out of Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' became out of stock after stock removal.",
        )

    await db.commit()

    return InventoryItemResponse(
        id=product.id,
        company_id=product.company_id,
        name=product.name,
        sku=product.sku,
        category_id=product.category_id,
        brand=product.brand,
        description=product.description,
        unit_price=float(product.unit_price),
        cost_price=float(product.cost_price),
        stock_quantity=product.stock_quantity,
        reserved_stock=product.reserved_stock,
        available_stock=available,
        low_stock_threshold=product.low_stock_threshold,
        stock_status=stock_status,
        unit_of_measure=product.unit_of_measure.value,
    )


@router.post("/adjust-stock", response_model=InventoryItemResponse)
async def adjust_stock(
    payload: InventoryAdjustmentCreate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if payload.quantity == 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be zero for manual adjustment")

    try:
        product = await inventory_crud.adjust_stock(
            db,
            current_user.company_id,
            payload.product_id,
            payload.quantity,
            current_user.id,
            reason=payload.reason,
            remarks=payload.remarks,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Stock Adjusted",
        request,
        entity_name=product.name,
        details=f"Adjusted {payload.quantity:+d} units of '{product.name}'",
    )

    available = product.stock_quantity - product.reserved_stock
    stock_status = get_status(available, product.low_stock_threshold)

    if stock_status == "LOW_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Low Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) has reached low stock level after manual adjustment. Available: {available}, Threshold: {product.low_stock_threshold}",
            NotificationType.LOW_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Reached Low Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' reached low stock after manual adjustment. Available: {available}",
        )
    elif stock_status == "OUT_OF_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Out of Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) is now out of stock after manual adjustment.",
            NotificationType.OUT_OF_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Became Out of Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' became out of stock after manual adjustment.",
        )

    await _create_notification(
        db,
        current_user.company_id,
        f"Manual Adjustment: {product.name}",
        f"Stock for '{product.name}' (SKU: {product.sku}) was manually adjusted by {current_user.name}. New quantity: {product.stock_quantity}, Change: {payload.quantity:+d}.",
        NotificationType.SYSTEM,
    )

    await db.commit()

    return InventoryItemResponse(
        id=product.id,
        company_id=product.company_id,
        name=product.name,
        sku=product.sku,
        category_id=product.category_id,
        brand=product.brand,
        description=product.description,
        unit_price=float(product.unit_price),
        cost_price=float(product.cost_price),
        stock_quantity=product.stock_quantity,
        reserved_stock=product.reserved_stock,
        available_stock=available,
        low_stock_threshold=product.low_stock_threshold,
        stock_status=stock_status,
        unit_of_measure=product.unit_of_measure.value,
    )


@router.patch("/{product_id}/reorder-level", response_model=InventoryItemResponse)
async def update_reorder_level(
    product_id: UUID,
    payload: ReorderLevelUpdate,
    request: Request,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    try:
        product = await inventory_crud.update_reorder_level(
            db,
            current_user.company_id,
            product_id,
            payload.low_stock_threshold,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await audit_service.log(
        db,
        current_user.company_id,
        current_user.id,
        "Reorder Level Updated",
        request,
        entity_name=product.name,
        details=f"Updated reorder level for '{product.name}' to {payload.low_stock_threshold}",
    )

    available = product.stock_quantity - product.reserved_stock
    stock_status = get_status(available, product.low_stock_threshold)

    if stock_status == "LOW_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Low Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) has reached low stock level. Available: {available}, Threshold: {product.low_stock_threshold}",
            NotificationType.LOW_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Reached Low Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' reached low stock after reorder level update. Available: {available}",
        )
    elif stock_status == "OUT_OF_STOCK":
        await _create_notification(
            db,
            current_user.company_id,
            f"Out of Stock: {product.name}",
            f"Product '{product.name}' (SKU: {product.sku}) is now out of stock.",
            NotificationType.OUT_OF_STOCK,
        )
        await audit_service.log(
            db,
            current_user.company_id,
            current_user.id,
            "Product Became Out of Stock",
            request,
            entity_name=product.name,
            details=f"Product '{product.name}' became out of stock after reorder level update.",
        )

    await db.commit()

    return InventoryItemResponse(
        id=product.id,
        company_id=product.company_id,
        name=product.name,
        sku=product.sku,
        category_id=product.category_id,
        brand=product.brand,
        description=product.description,
        unit_price=float(product.unit_price),
        cost_price=float(product.cost_price),
        stock_quantity=product.stock_quantity,
        reserved_stock=product.reserved_stock,
        available_stock=available,
        low_stock_threshold=product.low_stock_threshold,
        stock_status=stock_status,
        unit_of_measure=product.unit_of_measure.value,
    )
