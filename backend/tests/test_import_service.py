import pytest
from uuid import uuid4
from unittest.mock import AsyncMock

from app.models.import_history import ImportType
from app.services.import_ import ImportService


def test_clean_header():
    assert ImportService._clean_header("Product Name") == "product name"
    assert ImportService._clean_header("product_name") == "product name"
    assert ImportService._clean_header("  Product-Name (Required) ") == "product name required"
    assert ImportService._clean_header('\ufeff"SKU"') == "sku"
    assert ImportService._clean_header("Unit_Price ($)") == "unit price"


def test_parse_csv_comma_delimiter():
    content = b"Product Name,SKU,Unit Price\nWidget A,SKU-001,19.99\nWidget B,SKU-002,29.99"
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cols, rows = service.parse_csv(content)
    assert cols == ["Product Name", "SKU", "Unit Price"]
    assert len(rows) == 2
    assert rows[0]["Product Name"] == "Widget A"
    assert rows[0]["SKU"] == "SKU-001"
    assert rows[0]["Unit Price"] == "19.99"


def test_parse_csv_semicolon_delimiter():
    content = b"Product Name;SKU;Unit Price\nWidget A;SKU-001;19.99\nWidget B;SKU-002;29.99"
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cols, rows = service.parse_csv(content)
    assert cols == ["Product Name", "SKU", "Unit Price"]
    assert len(rows) == 2
    assert rows[0]["Product Name"] == "Widget A"
    assert rows[0]["SKU"] == "SKU-001"


def test_parse_csv_tab_delimiter():
    content = b"Product Name\tSKU\tUnit Price\nWidget A\tSKU-001\t19.99"
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cols, rows = service.parse_csv(content)
    assert cols == ["Product Name", "SKU", "Unit Price"]
    assert len(rows) == 1
    assert rows[0]["Product Name"] == "Widget A"


def test_validate_columns_with_aliases():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    # Alternate product column names
    cols = ["Name", "Product Code", "Category", "Price", "Stock"]
    service.validate_columns(ImportType.PRODUCTS, cols)  # Should not raise

    norm = service.normalize_row(ImportType.PRODUCTS, {"Name": "Smart Watch", "Product Code": "SW-01", "Category": "Electronics", "Price": "199.99", "Stock": "50"})
    assert norm["product_name"] == "Smart Watch"
    assert norm["sku"] == "SW-01"
    assert norm["unit_price"] == "199.99"
    assert norm["category"] == "Electronics"
    assert norm["stock_quantity"] == "50"


def test_validate_columns_missing_required():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cols = ["Category", "Stock Quantity"]
    with pytest.raises(ValueError) as exc_info:
        service.validate_columns(ImportType.PRODUCTS, cols)
    assert "Missing required column" in str(exc_info.value)
    assert "Product Name" in str(exc_info.value)


@pytest.mark.asyncio
async def test_validate_sales_multi_line_invoice():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cust_id = uuid4()
    prod1_id = uuid4()
    prod2_id = uuid4()

    customer_names = {"John Doe": cust_id}
    product_names = {"Widget A": prod1_id, "Widget B": prod2_id}
    available_stock = {prod1_id: 100, prod2_id: 100}

    # Multi-line invoice with the same invoice_number
    row1 = {"customer": "John Doe", "product": "Widget A", "quantity": "2", "unit_price": "10.00", "sale_date": "2026-08-12", "invoice_number": "INV-2026-000005"}
    row2 = {"customer": "John Doe", "product": "Widget B", "quantity": "1", "unit_price": "20.00", "sale_date": "2026-08-12", "invoice_number": "INV-2026-000005"}

    existing_invoices = set()
    service.validate_row(ImportType.SALES, 2, row1, set(), set(), set(), existing_invoices, customer_names, product_names, available_stock)
    service.validate_row(ImportType.SALES, 3, row2, set(), set(), set(), existing_invoices, customer_names, product_names, available_stock)
    assert available_stock[prod1_id] == 98
    assert available_stock[prod2_id] == 99

