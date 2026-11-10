import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal

from app.models.import_history import ImportType, ImportStatus
from app.models.product import Product
from app.services.import_ import ImportService, ImportValidationError, DuplicateRecordError


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
    cols = ["Name", "Product Code", "Category", "Price", "Stock"]
    service.validate_columns(ImportType.PRODUCTS, cols)

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


def test_validate_sales_multi_line_invoice():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cust_id = uuid4()
    prod1_id = uuid4()
    prod2_id = uuid4()

    customer_names = {"John Doe": cust_id}
    product_names = {"Widget A": prod1_id, "Widget B": prod2_id}
    available_stock = {prod1_id: 100, prod2_id: 100}

    row1 = {"customer": "John Doe", "product": "Widget A", "quantity": "2", "unit_price": "10.00", "sale_date": "2026-08-12", "invoice_number": "INV-2026-000005"}
    row2 = {"customer": "John Doe", "product": "Widget B", "quantity": "1", "unit_price": "20.00", "sale_date": "2026-08-12", "invoice_number": "INV-2026-000005"}

    service.validate_row(
        import_type=ImportType.SALES,
        row_number=2,
        normalized_row=row1,
        duplicate_strategy="REJECT",
        customer_names=customer_names,
        product_names=product_names,
        available_stock=available_stock,
    )
    service.validate_row(
        import_type=ImportType.SALES,
        row_number=3,
        normalized_row=row2,
        duplicate_strategy="REJECT",
        customer_names=customer_names,
        product_names=product_names,
        available_stock=available_stock,
    )
    assert available_stock[prod1_id] == 98
    assert available_stock[prod2_id] == 99


def test_validate_inventory_success():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    prod_id = uuid4()
    sku_to_id = {"SKU-100": prod_id}
    sku_stock = {"SKU-100": 50}

    row = {
        "sku": "SKU-100",
        "adjustment_type": "STOCK_IN",
        "quantity": "25",
        "reason": "Restock shipment",
        "remarks": "PO #1234",
    }
    res = service.validate_row(
        import_type=ImportType.INVENTORY,
        row_number=2,
        normalized_row=row,
        duplicate_strategy="REJECT",
        product_sku_to_id=sku_to_id,
        product_sku_stock=sku_stock,
    )
    assert res["action"] == "VALID"
    assert res["is_duplicate"] is False


def test_validate_inventory_insufficient_stock():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    prod_id = uuid4()
    sku_to_id = {"SKU-100": prod_id}
    sku_stock = {"SKU-100": 10}

    row = {
        "sku": "SKU-100",
        "adjustment_type": "STOCK_OUT",
        "quantity": "15",
        "reason": "Damaged goods",
    }
    with pytest.raises(ImportValidationError) as exc:
        service.validate_row(
            import_type=ImportType.INVENTORY,
            row_number=2,
            normalized_row=row,
            duplicate_strategy="REJECT",
            product_sku_to_id=sku_to_id,
            product_sku_stock=sku_stock,
        )
    assert "Insufficient stock" in str(exc.value)
    assert exc.value.error_type == "INSUFFICIENT_STOCK"


def test_validate_inventory_missing_product():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    row = {
        "sku": "UNKNOWN-SKU",
        "adjustment_type": "STOCK_IN",
        "quantity": "5",
        "reason": "Found in storage",
    }
    with pytest.raises(ImportValidationError) as exc:
        service.validate_row(
            import_type=ImportType.INVENTORY,
            row_number=2,
            normalized_row=row,
            product_sku_to_id={},
            product_sku_stock={},
        )
    assert "does not exist in catalog" in str(exc.value)
    assert exc.value.error_type == "FOREIGN_KEY_NOT_FOUND"


def test_duplicate_strategies_products():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    existing_skus = {"SKU-EXISTING"}
    row = {
        "product_name": "Premium Headphones",
        "sku": "SKU-EXISTING",
        "category": "Audio",
        "unit_price": "99.99",
        "stock_quantity": "15",
    }

    # REJECT strategy -> raises DuplicateRecordError
    with pytest.raises(DuplicateRecordError) as exc:
        service.validate_row(
            import_type=ImportType.PRODUCTS,
            row_number=2,
            normalized_row=row,
            duplicate_strategy="REJECT",
            existing_skus=existing_skus,
        )
    assert "already exists in the database" in str(exc.value)

    # SKIP strategy -> returns action="SKIP"
    res_skip = service.validate_row(
        import_type=ImportType.PRODUCTS,
        row_number=2,
        normalized_row=row,
        duplicate_strategy="SKIP",
        existing_skus=existing_skus,
    )
    assert res_skip["action"] == "SKIP"
    assert res_skip["is_duplicate"] is True

    # UPDATE strategy -> returns action="UPDATE"
    res_update = service.validate_row(
        import_type=ImportType.PRODUCTS,
        row_number=2,
        normalized_row=row,
        duplicate_strategy="UPDATE",
        existing_skus=existing_skus,
    )
    assert res_update["action"] == "UPDATE"
    assert res_update["is_duplicate"] is True


def test_templates_generation():
    for itype in (ImportType.PRODUCTS, ImportType.INVENTORY, ImportType.CUSTOMERS, ImportType.SALES):
        content, filename = ImportService.get_template_csv(itype)
        assert len(content) > 0
        assert filename.endswith(".csv")
        assert "SKU" in content or "Customer" in content or "Name" in content


def test_generate_error_csv():
    errors = [
        {
            "row_number": 3,
            "field": "unit_price",
            "error_type": "INVALID_DATA_TYPE",
            "error_message": "Invalid Unit Price: must be a valid number",
            "processing_status": "FAILED",
            "raw_data": "{'sku': 'SKU-1', 'unit_price': 'abc'}",
        }
    ]
    csv_out = ImportService.generate_error_csv(errors)
    assert "Row Number,Field,Error Type,Error Message,Processing Status,Record Data" in csv_out
    assert "INVALID_DATA_TYPE" in csv_out
    assert "Invalid Unit Price" in csv_out


def test_cancellation_flag():
    import_id = uuid4()
    assert ImportService.is_cancelled(import_id) is False
    ImportService.cancel_import(import_id)
    assert ImportService.is_cancelled(import_id) is True
    ImportService.clear_cancellation(import_id)
    assert ImportService.is_cancelled(import_id) is False


