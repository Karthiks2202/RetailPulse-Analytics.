import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import MagicMock

from app.crud.notification import notification as notification_crud
from app.crud.category import category as category_crud
from app.crud.product import product as product_crud
from app.models.notification import NotificationType, NotificationPriority, NotificationResourceType
from app.services.notification import notification_service
from app.models.product import Product, ProductStatus
from app.models.category import CategoryStatus
from app.models.import_history import ImportHistory, ImportStatus, ImportType


def _make_request():
    request = MagicMock()
    request.headers = {}
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    return request


class TestNotificationCRUD:
    @pytest.mark.asyncio
    async def test_create_notification(self, db_session: AsyncSession):
        company_id = uuid4()
        notif = await notification_crud.create(
            db_session,
            company_id=company_id,
            title="Test",
            message="Test message",
            type=NotificationType.SYSTEM_ALERT,
            priority=NotificationPriority.HIGH,
            resource_type=NotificationResourceType.PRODUCT,
            resource_id=uuid4(),
        )
        assert notif.id is not None
        assert notif.title == "Test"
        assert notif.priority == NotificationPriority.HIGH
        assert notif.is_read is False

    @pytest.mark.asyncio
    async def test_duplicate_prevention(self, db_session: AsyncSession):
        company_id = uuid4()
        resource_id = uuid4()
        notif1 = await notification_crud.create(
            db_session,
            company_id=company_id,
            title="Low Stock",
            message="Product low",
            type=NotificationType.LOW_STOCK,
            resource_type=NotificationResourceType.PRODUCT,
            resource_id=resource_id,
        )
        notif2 = await notification_crud.create(
            db_session,
            company_id=company_id,
            title="Low Stock Again",
            message="Product still low",
            type=NotificationType.LOW_STOCK,
            resource_type=NotificationResourceType.PRODUCT,
            resource_id=resource_id,
        )
        assert notif1 is not None
        assert notif2 is None

    @pytest.mark.asyncio
    async def test_mark_as_read(self, db_session: AsyncSession):
        company_id = uuid4()
        notif = await notification_crud.create(
            db_session,
            company_id=company_id,
            title="Test",
            message="Test",
            type=NotificationType.SYSTEM_ALERT,
        )
        assert notif.is_read is False
        updated = await notification_crud.mark_as_read(db_session, company_id, notif.id)
        assert updated.is_read is True
        assert updated.read_at is not None

    @pytest.mark.asyncio
    async def test_mark_all_as_read(self, db_session: AsyncSession):
        company_id = uuid4()
        await notification_crud.create(db_session, company_id=company_id, title="A", message="a", type=NotificationType.SYSTEM_ALERT)
        await notification_crud.create(db_session, company_id=company_id, title="B", message="b", type=NotificationType.SYSTEM_ALERT)
        await notification_crud.mark_all_as_read(db_session, company_id)
        count = await notification_crud.get_unread_count(db_session, company_id)
        assert count == 0

    @pytest.mark.asyncio
    async def test_company_isolation(self, db_session: AsyncSession):
        company_a = uuid4()
        company_b = uuid4()
        notif_a = await notification_crud.create(
            db_session, company_id=company_a, title="A", message="a", type=NotificationType.SYSTEM_ALERT
        )
        await notification_crud.create(
            db_session, company_id=company_b, title="B", message="b", type=NotificationType.SYSTEM_ALERT
        )
        fetched_a = await notification_crud.get_by_id(db_session, company_a, notif_a.id)
        assert fetched_a is not None
        fetched_b = await notification_crud.get_by_id(db_session, company_b, notif_a.id)
        assert fetched_b is None

    @pytest.mark.asyncio
    async def test_filtering(self, db_session: AsyncSession):
        company_id = uuid4()
        await notification_crud.create(db_session, company_id=company_id, title="Low", message="l", type=NotificationType.LOW_STOCK, priority=NotificationPriority.HIGH)
        await notification_crud.create(db_session, company_id=company_id, title="Out", message="o", type=NotificationType.OUT_OF_STOCK, priority=NotificationPriority.CRITICAL)
        await notification_crud.create(db_session, company_id=company_id, title="Sys", message="s", type=NotificationType.SYSTEM_ALERT, priority=NotificationPriority.LOW)

        all_notifs, total = await notification_crud.get_all(db_session, company_id)
        assert total == 3

        low_notifs, _ = await notification_crud.get_all(db_session, company_id, type=NotificationType.LOW_STOCK)
        assert len(low_notifs) == 1
        assert low_notifs[0].type == NotificationType.LOW_STOCK

        high_notifs, _ = await notification_crud.get_all(db_session, company_id, priority=NotificationPriority.HIGH)
        assert len(high_notifs) == 1

        read_notifs, _ = await notification_crud.get_all(db_session, company_id, is_read=True)
        assert len(read_notifs) == 0

    @pytest.mark.asyncio
    async def test_expires_at(self, db_session: AsyncSession):
        company_id = uuid4()
        past = datetime.utcnow() - timedelta(hours=1)
        future = datetime.utcnow() + timedelta(hours=1)
        await notification_crud.create(db_session, company_id=company_id, title="Old", message="o", type=NotificationType.SYSTEM_ALERT, expires_at=past)
        await notification_crud.create(db_session, company_id=company_id, title="New", message="n", type=NotificationType.SYSTEM_ALERT, expires_at=future)
        count = await notification_crud.get_unread_count(db_session, company_id)
        assert count == 1

    @pytest.mark.asyncio
    async def test_delete_expired(self, db_session: AsyncSession):
        company_id = uuid4()
        past = datetime.utcnow() - timedelta(hours=1)
        await notification_crud.create(db_session, company_id=company_id, title="Old", message="o", type=NotificationType.SYSTEM_ALERT, expires_at=past)
        deleted = await notification_crud.delete_expired(db_session, company_id)
        assert deleted == 1


class TestNotificationService:
    @pytest.mark.asyncio
    async def test_out_of_stock_alert(self, db_session: AsyncSession):
        company_id = uuid4()
        cat = await category_crud.create(db_session, company_id=company_id, name="Tech", description="", status=CategoryStatus.ACTIVE)
        product = Product(
            company_id=company_id,
            category_id=cat.id,
            name="Dell Laptop",
            sku="DL001",
            unit_price=1000.0,
            cost_price=600.0,
            stock_quantity=0,
            reserved_stock=0,
            low_stock_threshold=5,
            lead_time_days=7,
            unit_of_measure="PCS",
            status=ProductStatus.ACTIVE,
        )
        db_session.add(product)
        await db_session.flush()

        request = _make_request()
        await notification_service.evaluate_inventory_alerts(db_session, company_id, product, request, uuid4())
        await db_session.commit()

        notifs, total = await notification_crud.get_all(db_session, company_id, type=NotificationType.OUT_OF_STOCK)
        assert total == 1
        assert "0 stock" in notifs[0].message

    @pytest.mark.asyncio
    async def test_low_stock_alert(self, db_session: AsyncSession):
        company_id = uuid4()
        cat = await category_crud.create(db_session, company_id=company_id, name="Tech", description="", status=CategoryStatus.ACTIVE)
        product = Product(
            company_id=company_id,
            category_id=cat.id,
            name="Mouse",
            sku="MS001",
            unit_price=20.0,
            cost_price=10.0,
            stock_quantity=3,
            reserved_stock=0,
            low_stock_threshold=5,
            lead_time_days=7,
            unit_of_measure="PCS",
            status=ProductStatus.ACTIVE,
        )
        db_session.add(product)
        await db_session.flush()

        request = _make_request()
        await notification_service.evaluate_inventory_alerts(db_session, company_id, product, request, uuid4())
        await db_session.commit()

        notifs, total = await notification_crud.get_all(db_session, company_id, type=NotificationType.LOW_STOCK)
        assert total == 1
        assert notifs[0].priority == NotificationPriority.HIGH

    @pytest.mark.asyncio
    async def test_import_notification(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()
        import_hist = ImportHistory(
            company_id=company_id,
            import_type=ImportType.PRODUCTS,
            filename="products.csv",
            uploaded_by=user_id,
            total_records=10,
            successful_records=10,
            failed_records=0,
            duplicate_records=0,
            status=ImportStatus.COMPLETED,
        )
        db_session.add(import_hist)
        await db_session.flush()

        request = _make_request()
        await notification_service.on_import_completed(db_session, company_id, import_hist, request, user_id)
        await db_session.commit()

        notifs, total = await notification_crud.get_all(db_session, company_id, type=NotificationType.IMPORT_COMPLETED)
        assert total == 1
        assert "products.csv" in notifs[0].title

    @pytest.mark.asyncio
    async def test_bulk_evaluation(self, db_session: AsyncSession):
        company_id = uuid4()
        cat = await category_crud.create(db_session, company_id=company_id, name="Tech", description="", status=CategoryStatus.ACTIVE)
        for i in range(3):
            product = Product(
                company_id=company_id,
                category_id=cat.id,
                name=f"Product {i}",
                sku=f"SKU-{i}",
                unit_price=10.0,
                cost_price=5.0,
                stock_quantity=0,
                reserved_stock=0,
                low_stock_threshold=5,
                lead_time_days=7,
                unit_of_measure="PCS",
                status=ProductStatus.ACTIVE,
            )
            db_session.add(product)
        await db_session.flush()

        request = _make_request()
        result = await notification_service.run_bulk_evaluation(db_session, company_id, request, uuid4())
        await db_session.commit()

        assert result["evaluated"] == 3
        count = await notification_crud.get_unread_count(db_session, company_id)
        assert count >= 3
