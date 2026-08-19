import csv
import io
import os
import pytest
from datetime import datetime, timedelta, time
from uuid import UUID, uuid4
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.crud.sale import sale as sale_crud
from app.crud.product import product as product_crud
from app.crud.category import category as category_crud
from app.crud.customer import customer as customer_crud
from app.services.analytics import analytics_service
from app.models.sale import SaleStatus, PaymentStatus, SalesChannel, PaymentMethod
from app.models.product import ProductStatus
from app.models.category import CategoryStatus
from app.models.customer import CustomerStatus


def _make_request():
    request = MagicMock()
    request.headers = {}
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    return request


def _is_sqlite() -> bool:
    db_url = os.environ.get("DATABASE_URL", "")
    return "sqlite" in db_url


class TestAnalyticsKPIs:
    @pytest.mark.asyncio
    async def test_kpi_empty_result(self, db_session: AsyncSession):
        company_id = uuid4()
        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id)
        assert kpi["total_revenue"] == 0.0
        assert kpi["total_orders"] == 0
        assert kpi["total_products_sold"] == 0
        assert kpi["average_order_value"] == 0.0
        assert kpi["total_discount"] == 0.0
        assert kpi["total_tax"] == 0.0
        assert kpi["total_inventory_value"] == 0.0
        assert kpi["low_stock_products"] == 0
        assert kpi["out_of_stock_products"] == 0
        assert kpi["total_categories"] == 0

    @pytest.mark.asyncio
    async def test_kpi_aggregation_with_sales(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        laptop = await product_crud.create(
            db_session, company_id=company_id, name="Laptop", sku="LP-1",
            category_id=cat.id, brand="TechCo", description="", unit_price=1000.0,
            cost_price=600.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer A", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": laptop.id, "quantity": 2, "unit_price": 1000.0, "discount": 100.0, "tax": 50.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer B", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.ONLINE, payment_method="Card",
                items=[{"product_id": laptop.id, "quantity": 1, "unit_price": 1000.0, "discount": 0.0, "tax": 20.0}],
                request=_make_request(),
            )

        await db_session.refresh(laptop)
        assert laptop.stock_quantity == 7

        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id)
        assert kpi["total_revenue"] == 2970.0
        assert kpi["total_orders"] == 2
        assert kpi["total_products_sold"] == 3
        assert kpi["total_discount"] == 100.0
        assert kpi["total_tax"] == 70.0
        assert kpi["average_order_value"] == 1485.0
        assert kpi["total_inventory_value"] == 4200.0
        assert kpi["total_categories"] == 1

    @pytest.mark.asyncio
    async def test_kpi_date_filter(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        old_date = datetime.utcnow() - timedelta(days=30)
        recent_date = datetime.utcnow() - timedelta(days=1)

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=old_date,
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=recent_date,
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        date_from = datetime.utcnow() - timedelta(days=7)
        filters = {"date_from": date_from}
        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id, filters)
        assert kpi["total_revenue"] == 200.0
        assert kpi["total_orders"] == 1
        assert kpi["total_products_sold"] == 2

    @pytest.mark.asyncio
    async def test_kpi_product_filter(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        laptop = await product_crud.create(
            db_session, company_id=company_id, name="Laptop", sku="LP-1",
            category_id=cat.id, brand="TechCo", description="", unit_price=1000.0,
            cost_price=600.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )
        mouse = await product_crud.create(
            db_session, company_id=company_id, name="Mouse", sku="MS-1",
            category_id=cat.id, brand="TechCo", description="", unit_price=50.0,
            cost_price=20.0, stock_quantity=20, low_stock_threshold=5,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[
                    {"product_id": laptop.id, "quantity": 1, "unit_price": 1000.0, "discount": 0.0, "tax": 0.0},
                    {"product_id": mouse.id, "quantity": 2, "unit_price": 50.0, "discount": 0.0, "tax": 0.0},
                ],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": mouse.id, "quantity": 1, "unit_price": 50.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id, {"product_id": laptop.id})
        assert kpi["total_revenue"] == 1000.0
        assert kpi["total_orders"] == 1
        assert kpi["total_products_sold"] == 1

    @pytest.mark.asyncio
    async def test_kpi_category_filter(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat_electronics = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        cat_clothing = await category_crud.create(db_session, company_id=company_id, name="Clothing", description="", status=CategoryStatus.ACTIVE)
        laptop = await product_crud.create(
            db_session, company_id=company_id, name="Laptop", sku="LP-1",
            category_id=cat_electronics.id, brand="TechCo", description="", unit_price=1000.0,
            cost_price=600.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )
        shirt = await product_crud.create(
            db_session, company_id=company_id, name="Shirt", sku="SH-1",
            category_id=cat_clothing.id, brand="Brand", description="", unit_price=50.0,
            cost_price=20.0, stock_quantity=20, low_stock_threshold=5,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[
                    {"product_id": laptop.id, "quantity": 1, "unit_price": 1000.0, "discount": 0.0, "tax": 0.0},
                    {"product_id": shirt.id, "quantity": 1, "unit_price": 50.0, "discount": 0.0, "tax": 0.0},
                ],
                request=_make_request(),
            )

        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id, {"category_id": cat_electronics.id})
        assert kpi["total_revenue"] == 1000.0
        assert kpi["total_orders"] == 1
        assert kpi["total_products_sold"] == 1

    @pytest.mark.asyncio
    async def test_kpi_customer_filter(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        customer_a = await customer_crud.create(
            db_session, company_id=company_id, first_name="A", last_name="Customer",
            email="a@test.com", phone="1234567890", date_of_birth=None, gender=None,
            address="Test", city="Test", state="Test", country="Test", postal_code="12345",
            customer_type="RETAIL", preferred_sales_channel=None, notes=None,
            status=CustomerStatus.ACTIVE,
        )
        customer_b = await customer_crud.create(
            db_session, company_id=company_id, first_name="B", last_name="Customer",
            email="b@test.com", phone="1234567891", date_of_birth=None, gender=None,
            address="Test", city="Test", state="Test", country="Test", postal_code="12345",
            customer_type="RETAIL", preferred_sales_channel=None, notes=None,
            status=CustomerStatus.ACTIVE,
        )

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer A", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(), customer_id=customer_a.id,
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer B", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(), customer_id=customer_b.id,
            )

        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id, {"customer_id": customer_a.id})
        assert kpi["total_revenue"] == 100.0
        assert kpi["total_orders"] == 1
        assert kpi["total_products_sold"] == 1

    @pytest.mark.asyncio
    async def test_kpi_payment_filter(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Card",
                items=[{"product_id": product.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id, {"payment_method": "Cash"})
        assert kpi["total_revenue"] == 100.0
        assert kpi["total_orders"] == 1
        assert kpi["total_products_sold"] == 1


@pytest.mark.skipif(_is_sqlite(), reason="date_trunc requires PostgreSQL")
class TestAnalyticsTrends:
    @pytest.mark.asyncio
    async def test_revenue_trend_daily(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        sale_dates = [today - timedelta(days=2), today - timedelta(days=1), today]

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002", "INV-2026-000003"]):
            for d in sale_dates:
                await sale_crud.create(
                    db_session, company_id=company_id, user_id=user_id,
                    customer_name="Customer", sale_date=d,
                    sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                    items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                    request=_make_request(),
                )

        date_from = today - timedelta(days=5)
        date_to = today
        filters = {"date_from": date_from, "date_to": date_to}
        trend = await analytics_service.get_revenue_trend(db_session, company_id, filters, interval="daily")
        assert len(trend) == 6
        assert sum(p["revenue"] for p in trend) == 300.0
        assert sum(p["orders"] for p in trend) == 3

    @pytest.mark.asyncio
    async def test_revenue_trend_weekly(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        this_week_start = today - timedelta(days=today.weekday())
        sale_dates = [this_week_start, this_week_start + timedelta(days=2)]

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            for d in sale_dates:
                await sale_crud.create(
                    db_session, company_id=company_id, user_id=user_id,
                    customer_name="Customer", sale_date=d,
                    sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                    items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                    request=_make_request(),
                )

        date_from = this_week_start - timedelta(days=7)
        date_to = this_week_start + timedelta(days=6)
        filters = {"date_from": date_from, "date_to": date_to}
        trend = await analytics_service.get_revenue_trend(db_session, company_id, filters, interval="weekly")
        assert len(trend) == 2
        assert sum(p["revenue"] for p in trend) == 200.0

    @pytest.mark.asyncio
    async def test_revenue_trend_monthly(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)
        sale_dates = [month_start, month_start + timedelta(days=15)]

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            for d in sale_dates:
                await sale_crud.create(
                    db_session, company_id=company_id, user_id=user_id,
                    customer_name="Customer", sale_date=d,
                    sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                    items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                    request=_make_request(),
                )

        date_from = month_start - timedelta(days=30)
        date_to = month_start + timedelta(days=30)
        filters = {"date_from": date_from, "date_to": date_to}
        trend = await analytics_service.get_revenue_trend(db_session, company_id, filters, interval="monthly")
        assert len(trend) == 2
        assert sum(p["revenue"] for p in trend) == 200.0

    @pytest.mark.asyncio
    async def test_sales_trend_daily(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        sale_date = today - timedelta(days=1)

        with patch.object(sale_crud, 'get_invoice_number', return_value="INV-2026-000001"):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=sale_date,
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        date_from = today - timedelta(days=5)
        date_to = today
        filters = {"date_from": date_from, "date_to": date_to}
        trend = await analytics_service.get_sales_trend(db_session, company_id, filters, interval="daily")
        assert len(trend) == 6
        assert sum(p["sales"] for p in trend) == 100.0
        assert sum(p["orders"] for p in trend) == 1


class TestAnalyticsTopProducts:
    @pytest.mark.asyncio
    async def test_top_products_sort_by_quantity(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product_a = await product_crud.create(
            db_session, company_id=company_id, name="Product A", sku="PA-1",
            category_id=cat.id, brand="Brand", description="", unit_price=10.0,
            cost_price=5.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )
        product_b = await product_crud.create(
            db_session, company_id=company_id, name="Product B", sku="PB-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product_a.id, "quantity": 5, "unit_price": 10.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product_b.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        result = await analytics_service.get_top_products(db_session, company_id, sort_by="total_quantity", sort_order="desc")
        assert result["items"][0]["product_id"] == product_a.id
        assert result["items"][0]["total_quantity"] == 5
        assert result["total"] == 2

    @pytest.mark.asyncio
    async def test_top_products_sort_by_revenue(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product_a = await product_crud.create(
            db_session, company_id=company_id, name="Product A", sku="PA-1",
            category_id=cat.id, brand="Brand", description="", unit_price=10.0,
            cost_price=5.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )
        product_b = await product_crud.create(
            db_session, company_id=company_id, name="Product B", sku="PB-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product_a.id, "quantity": 5, "unit_price": 10.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product_b.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        result = await analytics_service.get_top_products(db_session, company_id, sort_by="total_revenue", sort_order="desc")
        assert result["items"][0]["product_id"] == product_b.id
        assert result["items"][0]["total_revenue"] == 200.0


class TestAnalyticsTopCustomers:
    @pytest.mark.asyncio
    async def test_top_customers_aggregation(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        customer_a = await customer_crud.create(
            db_session, company_id=company_id, first_name="A", last_name="Customer",
            email="a@test.com", phone="1234567890", date_of_birth=None, gender=None,
            address="Test", city="Test", state="Test", country="Test", postal_code="12345",
            customer_type="RETAIL", preferred_sales_channel=None, notes=None,
            status=CustomerStatus.ACTIVE,
        )
        customer_b = await customer_crud.create(
            db_session, company_id=company_id, first_name="B", last_name="Customer",
            email="b@test.com", phone="1234567891", date_of_birth=None, gender=None,
            address="Test", city="Test", state="Test", country="Test", postal_code="12345",
            customer_type="RETAIL", preferred_sales_channel=None, notes=None,
            status=CustomerStatus.ACTIVE,
        )

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002", "INV-2026-000003"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="A Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(), customer_id=customer_a.id,
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="B Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 3, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(), customer_id=customer_b.id,
            )

        result = await analytics_service.get_top_customers(db_session, company_id)
        assert result["total"] == 2
        assert result["items"][0]["id"] == customer_b.id
        assert result["items"][0]["total_spent"] == 300.0
        assert result["items"][0]["total_purchases"] == 1


class TestAnalyticsPaymentMethods:
    @pytest.mark.asyncio
    async def test_payment_method_aggregation(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002", "INV-2026-000003"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Card",
                items=[{"product_id": product.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        result = await analytics_service.get_payment_method_breakdown(db_session, company_id)
        assert len(result) == 2
        cash = next(r for r in result if r["payment_method"] == "Cash")
        card = next(r for r in result if r["payment_method"] == "Card")
        assert cash["total_orders"] == 2
        assert cash["total_revenue"] == 200.0
        assert card["total_orders"] == 1
        assert card["total_revenue"] == 200.0
        assert abs(cash["percentage"] + card["percentage"] - 100.0) < 0.01

    @pytest.mark.asyncio
    async def test_payment_method_with_filters(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000002"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.ONLINE, payment_method="Card",
                items=[{"product_id": product.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        result = await analytics_service.get_payment_method_breakdown(db_session, company_id, {"sales_channel": "Online Store"})
        assert len(result) == 1
        assert result[0]["payment_method"] == "Card"
        assert result[0]["total_orders"] == 1
        assert result[0]["total_revenue"] == 200.0


class TestAnalyticsEmptyAndInvalid:
    @pytest.mark.asyncio
    async def test_empty_result_returns_empty_lists(self, db_session: AsyncSession):
        company_id = uuid4()

        kpi = await analytics_service.get_kpi_dashboard(db_session, company_id)
        assert kpi["total_revenue"] == 0.0
        assert kpi["total_orders"] == 0

        if not _is_sqlite():
            trend = await analytics_service.get_revenue_trend(db_session, company_id, interval="daily")
            assert all(p["revenue"] == 0.0 for p in trend)
            assert all(p["orders"] == 0 for p in trend)

        top_products = await analytics_service.get_top_products(db_session, company_id)
        assert top_products["items"] == []
        assert top_products["total"] == 0

        top_customers = await analytics_service.get_top_customers(db_session, company_id)
        assert top_customers["items"] == []
        assert top_customers["total"] == 0

        payment_methods = await analytics_service.get_payment_method_breakdown(db_session, company_id)
        assert payment_methods == []

        transactions = await analytics_service.drill_down_transactions(db_session, company_id)
        assert transactions == []

    def test_invalid_date_filter_raises_error(self):
        from app.routers.analytics import _parse_filters
        with pytest.raises(HTTPException) as exc_info:
            _parse_filters(
                date_from="invalid-date",
                date_to=None,
                product_id=None,
                category_id=None,
                brand=None,
                sales_channel=None,
                payment_method=None,
                customer_id=None,
            )
        assert exc_info.value.status_code == 400
        assert "Invalid date_from format" in exc_info.value.detail

    def test_invalid_product_id_filter_raises_error(self):
        from app.routers.analytics import _parse_filters
        with pytest.raises(HTTPException) as exc_info:
            _parse_filters(
                date_from=None,
                date_to=None,
                product_id="not-a-uuid",
                category_id=None,
                brand=None,
                sales_channel=None,
                payment_method=None,
                customer_id=None,
            )
        assert exc_info.value.status_code == 400
        assert "Invalid product_id format" in exc_info.value.detail

    def test_invalid_category_id_filter_raises_error(self):
        from app.routers.analytics import _parse_filters
        with pytest.raises(HTTPException) as exc_info:
            _parse_filters(
                date_from=None,
                date_to=None,
                product_id=None,
                category_id="not-a-uuid",
                brand=None,
                sales_channel=None,
                payment_method=None,
                customer_id=None,
            )
        assert exc_info.value.status_code == 400
        assert "Invalid category_id format" in exc_info.value.detail

    def test_invalid_customer_id_filter_raises_error(self):
        from app.routers.analytics import _parse_filters
        with pytest.raises(HTTPException) as exc_info:
            _parse_filters(
                date_from=None,
                date_to=None,
                product_id=None,
                category_id=None,
                brand=None,
                sales_channel=None,
                payment_method=None,
                customer_id="not-a-uuid",
            )
        assert exc_info.value.status_code == 400
        assert "Invalid customer_id format" in exc_info.value.detail


class TestAnalyticsExport:
    @pytest.mark.asyncio
    async def test_export_kpis_data_shape(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        data = await analytics_service.get_kpi_dashboard(db_session, company_id)
        assert data["total_revenue"] == 100.0
        assert data["total_orders"] == 1

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data.keys())
        writer.writeheader()
        writer.writerow(data)
        csv_content = output.getvalue()
        assert "total_revenue" in csv_content
        assert "100.0" in csv_content

    @pytest.mark.asyncio
    async def test_export_sales_trend_data_shape(self, db_session: AsyncSession):
        if _is_sqlite():
            trend_data = [
                {"period": "2026-08-19", "sales": 100.0, "orders": 1},
                {"period": "2026-08-20", "sales": 200.0, "orders": 2},
            ]
        else:
            company_id = uuid4()
            user_id = uuid4()

            cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
            product = await product_crud.create(
                db_session, company_id=company_id, name="Product", sku="P-1",
                category_id=cat.id, brand="Brand", description="", unit_price=100.0,
                cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
                unit_of_measure="PCS", status=ProductStatus.ACTIVE,
            )

            with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001"]):
                await sale_crud.create(
                    db_session, company_id=company_id, user_id=user_id,
                    customer_name="Customer", sale_date=datetime.utcnow(),
                    sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                    items=[{"product_id": product.id, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                    request=_make_request(),
                )

            trend_data = await analytics_service.get_sales_trend(db_session, company_id, interval="daily")

        assert len(trend_data) > 0
        assert "period" in trend_data[0]
        assert "sales" in trend_data[0]

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=trend_data[0].keys())
        writer.writeheader()
        for row in trend_data:
            writer.writerow(row)
        csv_content = output.getvalue()
        assert "period" in csv_content
        assert "sales" in csv_content

    @pytest.mark.asyncio
    async def test_export_top_products_data_shape(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        cat = await category_crud.create(db_session, company_id=company_id, name="Electronics", description="", status=CategoryStatus.ACTIVE)
        product = await product_crud.create(
            db_session, company_id=company_id, name="Product", sku="P-1",
            category_id=cat.id, brand="Brand", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=2,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001"]):
            await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Customer", sale_date=datetime.utcnow(),
                sales_channel=SalesChannel.RETAIL, payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        result = await analytics_service.get_top_products(db_session, company_id, page=1, page_size=10)
        assert "items" in result
        assert "total" in result
        assert len(result["items"]) > 0
        assert result["items"][0]["total_quantity"] == 2

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=result["items"][0].keys())
        writer.writeheader()
        for row in result["items"]:
            writer.writerow(row)
        csv_content = output.getvalue()
        assert "product_name" in csv_content
        assert "total_quantity" in csv_content
