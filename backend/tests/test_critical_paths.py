import pytest
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, MagicMock

from app.crud.sale import sale as sale_crud
from app.crud.product import product as product_crud
from app.crud.customer import customer as customer_crud
from app.services.forecast import forecast_service
from app.models.sale import SaleStatus, PaymentStatus
from app.models.product import ProductStatus
from app.models.customer import CustomerStatus, CustomerSegment
from app.models.inventory import MovementType
from app.models.forecast import ForecastPeriodType


def _make_request():
    request = MagicMock()
    request.headers = {}
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    return request


class TestSaleCreate:
    @pytest.mark.asyncio
    async def test_create_sale_atomicity(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        product = await product_crud.create(
            db_session, company_id=company_id, name="Test Product", sku="SKU-001",
            category_id=None, brand="Test", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=10, low_stock_threshold=5,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        customer = await customer_crud.create(
            db_session, company_id=company_id, first_name="Test", last_name="Customer",
            email="test@test.com", phone="1234567890", date_of_birth=None, gender=None,
            address="Test", city="Test", state="Test", country="Test", postal_code="12345",
            customer_type="RETAIL", preferred_sales_channel=None, notes=None,
            status=CustomerStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', side_effect=["INV-2026-000001", "INV-2026-000001", "INV-2026-000001"]):
            sale = await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Test Customer", sale_date=datetime.utcnow(),
                sales_channel="Retail Store", payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 2, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(), customer_id=customer.id,
            )

        assert sale.id is not None
        assert len(sale.items) == 1
        assert sale.total_amount == Decimal("200.00")

        await db_session.refresh(product)
        assert product.stock_quantity == 8

    @pytest.mark.asyncio
    async def test_product_not_marked_inactive_on_zero_stock(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        product = await product_crud.create(
            db_session, company_id=company_id, name="Test Product 2", sku="SKU-002",
            category_id=None, brand="Test", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=5, low_stock_threshold=5,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', return_value="INV-2026-000002"):
            sale = await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Test Customer", sale_date=datetime.utcnow(),
                sales_channel="Retail Store", payment_method="Cash",
                items=[{"product_id": product.id, "quantity": 5, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(),
            )

        await db_session.refresh(product)
        assert product.stock_quantity == 0
        assert product.status == ProductStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_delete_sale_recalculates_segment(self, db_session: AsyncSession):
        company_id = uuid4()
        user_id = uuid4()

        customer = await customer_crud.create(
            db_session, company_id=company_id, first_name="Test", last_name="Customer2",
            email="test2@test.com", phone="1234567890", date_of_birth=None, gender=None,
            address="Test", city="Test", state="Test", country="Test", postal_code="12345",
            customer_type="RETAIL", preferred_sales_channel=None, notes=None,
            status=CustomerStatus.ACTIVE,
        )

        with patch.object(sale_crud, 'get_invoice_number', return_value="INV-2026-000003"):
            sale = await sale_crud.create(
                db_session, company_id=company_id, user_id=user_id,
                customer_name="Test Customer2", sale_date=datetime.utcnow(),
                sales_channel="Retail Store", payment_method="Cash",
                items=[{"product_id": None, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                request=_make_request(), customer_id=customer.id,
            )

        segment_after_create = await customer_crud.get_segment(db_session, customer.id)
        assert segment_after_create == "NEW"

        await sale_crud.delete(db_session, sale_id=sale.id, company_id=company_id, user_id=user_id, request=_make_request())

        segment_after_delete = await customer_crud.get_segment(db_session, customer.id)
        assert segment_after_delete == "NEW"


class TestForecast:
    @pytest.mark.asyncio
    async def test_forecast_daily_aggregation(self, db_session: AsyncSession):
        company_id = uuid4()

        product = await product_crud.create(
            db_session, company_id=company_id, name="Forecast Product", sku="SKU-F-001",
            category_id=None, brand="Test", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=100, low_stock_threshold=5,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        sale_date = datetime.utcnow() - timedelta(days=5)

        for i in range(3):
            with patch.object(sale_crud, 'get_invoice_number', side_effect=[f"INV-2026-00000{i+4}"]):
                await sale_crud.create(
                    db_session, company_id=company_id, user_id=uuid4(),
                    customer_name="Customer", sale_date=sale_date,
                    sales_channel="Retail Store", payment_method="Cash",
                    items=[{"product_id": product.id, "quantity": 10, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                    request=_make_request(),
                )

        sales_data = await forecast_service._get_historical_sales(db_session, company_id, product.id, days_back=10)
        assert len(sales_data) == 11
        assert sales_data[5] == 30
        assert all(v == 0 for i, v in enumerate(sales_data) if i != 5)

    @pytest.mark.asyncio
    async def test_duplicate_forecast_prevention(self, db_session: AsyncSession):
        company_id = uuid4()

        product = await product_crud.create(
            db_session, company_id=company_id, name="Forecast Product 2", sku="SKU-F-002",
            category_id=None, brand="Test", description="", unit_price=100.0,
            cost_price=50.0, stock_quantity=100, low_stock_threshold=5,
            unit_of_measure="PCS", status=ProductStatus.ACTIVE,
        )

        forecast1 = await forecast_service.generate_product_forecast(
            db_session, company_id, product.id,
            forecast_period=ForecastPeriodType.NEXT_7_DAYS,
        )
        assert forecast1.id is not None

        forecast2 = await forecast_service.generate_product_forecast(
            db_session, company_id, product.id,
            forecast_period=ForecastPeriodType.NEXT_7_DAYS,
        )
        assert forecast2.id == forecast1.id


class TestCustomerSummary:
    @pytest.mark.asyncio
    async def test_batch_customer_summaries(self, db_session: AsyncSession):
        company_id = uuid4()

        customer = await customer_crud.create(
            db_session, company_id=company_id, first_name="Batch", last_name="Test",
            email="batch@test.com", phone="1234567890", date_of_birth=None, gender=None,
            address="Test", city="Test", state="Test", country="Test", postal_code="12345",
            customer_type="RETAIL", preferred_sales_channel=None, notes=None,
            status=CustomerStatus.ACTIVE,
        )

        for i in range(3):
            with patch.object(sale_crud, 'get_invoice_number', side_effect=[f"INV-2026-00001{i+4}"]):
                await sale_crud.create(
                    db_session, company_id=company_id, user_id=uuid4(),
                    customer_name="Batch Test", sale_date=datetime.utcnow() - timedelta(days=10),
                    sales_channel="Retail Store", payment_method="Cash",
                    items=[{"product_id": None, "quantity": 1, "unit_price": 100.0, "discount": 0.0, "tax": 0.0}],
                    request=_make_request(), customer_id=customer.id,
                )

        summaries = await customer_crud.get_customers_purchase_summaries(db_session, company_id, [customer.id])
        assert customer.id in summaries
        assert summaries[customer.id]["total_purchases"] == 3
        assert summaries[customer.id]["total_spent"] == 300.0
