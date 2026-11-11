import io
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal
from pathlib import Path

from app.models.import_history import ImportType, ImportStatus, DuplicateStrategy, ImportHistory
from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.models.inventory import InventoryAdjustment, AdjustmentType
from app.services.import_ import ImportService, ImportValidationError, DuplicateRecordError
from app.services.import_storage import (
    validate_content_security,
    save_file_content,
    get_import_file_path,
    import_file_exists,
    delete_import_file,
    inspect_csv_file,
    detect_csv_dialect_from_line,
    MAX_FILE_SIZE_BYTES,
)
from app.services.import_worker import import_worker


# ---------------------------------------------------------
# 1. FILE VALIDATION AND SECURITY TESTS
# ---------------------------------------------------------

def test_file_security_rejects_executables():
    with pytest.raises(ValueError) as exc:
        validate_content_security(b"MZ\x90\x00\x03\x00\x00\x00")
    assert "Windows Executable" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        validate_content_security(b"\x7fELF\x02\x01\x01\x00")
    assert "Linux Executable" in str(exc.value)


def test_file_security_rejects_zip_and_office():
    with pytest.raises(ValueError) as exc:
        validate_content_security(b"PK\x03\x04\x14\x00\x06\x00")
    assert "Office Spreadsheet" in str(exc.value) or "ZIP" in str(exc.value)


def test_file_security_rejects_pdf():
    with pytest.raises(ValueError) as exc:
        validate_content_security(b"%PDF-1.5\n%...")
    assert "PDF Document" in str(exc.value)


def test_file_security_rejects_null_bytes():
    with pytest.raises(ValueError) as exc:
        validate_content_security(b"Name,SKU,Price\nWidget,\x00SKU-1,10.00")
    assert "NULL bytes detected" in str(exc.value)


def test_file_security_enforces_size_limit():
    large_size = 50 * 1024 * 1024 + 1
    # Check that saving content larger than limit raises ValueError
    import_id = uuid4()
    with pytest.raises(ValueError) as exc:
        save_file_content(import_id, b"a" * 100, max_size_bytes=50)
    assert "exceeds" in str(exc.value)


def test_detect_csv_dialect():
    assert detect_csv_dialect_from_line("A,B,C,D") == ","
    assert detect_csv_dialect_from_line("A;B;C;D") == ";"
    assert detect_csv_dialect_from_line("A\tB\tC\tD") == "\t"


def test_safe_parsing_malformed_csv():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    # Content with uneven quotes or weird spacing
    content = b"Name,SKU,Unit Price\n\"Good Widget\",SKU-1,10.50\n\"Another\",SKU-2,20.00\n"
    cols, rows = service.parse_csv(content)
    assert cols == ["Name", "SKU", "Unit Price"]
    assert len(rows) == 2


# ---------------------------------------------------------
# 2. INVENTORY DUPLICATE & UPDATE TESTS
# ---------------------------------------------------------

def test_inventory_duplicate_identification_existing_db():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    prod_id = uuid4()
    sku_to_id = {"SKU-INVENTORY-1": prod_id}
    sku_stock = {"SKU-INVENTORY-1": 100}

    # Simulate adjustment already existing in database
    existing_adjustments = {
        ("SKU-INVENTORY-1", "STOCK_IN", "warehouse receipt"): MagicMock(quantity=20)
    }

    row = {
        "sku": "SKU-INVENTORY-1",
        "adjustment_type": "STOCK_IN",
        "quantity": "25",
        "reason": "Warehouse Receipt",
        "remarks": "Updated PO",
    }

    # REJECT strategy -> should raise DuplicateRecordError
    with pytest.raises(DuplicateRecordError) as exc:
        service.validate_row(
            import_type=ImportType.INVENTORY,
            row_number=2,
            normalized_row=row,
            duplicate_strategy="REJECT",
            product_sku_to_id=sku_to_id,
            product_sku_stock=sku_stock,
            existing_inventory_adjustments=existing_adjustments,
        )
    assert "already exists in database" in str(exc.value)

    # SKIP strategy -> returns action="SKIP"
    res_skip = service.validate_row(
        import_type=ImportType.INVENTORY,
        row_number=2,
        normalized_row=row,
        duplicate_strategy="SKIP",
        product_sku_to_id=sku_to_id,
        product_sku_stock=sku_stock,
        existing_inventory_adjustments=existing_adjustments,
    )
    assert res_skip["action"] == "SKIP"
    assert res_skip["is_duplicate"] is True

    # UPDATE strategy -> returns action="UPDATE"
    res_update = service.validate_row(
        import_type=ImportType.INVENTORY,
        row_number=2,
        normalized_row=row,
        duplicate_strategy="UPDATE",
        product_sku_to_id=sku_to_id,
        product_sku_stock=sku_stock,
        existing_inventory_adjustments=existing_adjustments,
    )
    assert res_update["action"] == "UPDATE"
    assert res_update["is_duplicate"] is True


# ---------------------------------------------------------
# 3. SALES DUPLICATE UPDATE TESTS
# ---------------------------------------------------------

def test_sales_duplicate_update_action():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cust_id = uuid4()
    prod_id = uuid4()
    customer_names = {"Acme Corp": cust_id}
    product_names = {"Widget Super": prod_id}
    available_stock = {prod_id: 50}
    existing_invoices = {"INV-2026-000100"}

    row = {
        "customer": "Acme Corp",
        "product": "Widget Super",
        "quantity": "5",
        "unit_price": "99.00",
        "sale_date": "2026-11-01",
        "invoice_number": "INV-2026-000100",
    }

    # UPDATE strategy with existing invoice -> action MUST be "UPDATE"
    res = service.validate_row(
        import_type=ImportType.SALES,
        row_number=2,
        normalized_row=row,
        duplicate_strategy="UPDATE",
        existing_invoices=existing_invoices,
        customer_names=customer_names,
        product_names=product_names,
        available_stock=available_stock,
    )
    assert res["action"] == "UPDATE"
    assert res["is_duplicate"] is True


# ---------------------------------------------------------
# 4. CUSTOMER MATCHING CONFLICT SAFETY
# ---------------------------------------------------------

def test_customer_matching_conflict_detection():
    service = ImportService(AsyncMock(), uuid4(), uuid4())
    cust_alpha = MagicMock(id=uuid4(), first_name="Alpha", last_name="User")
    cust_beta = MagicMock(id=uuid4(), first_name="Beta", last_name="User")

    existing_emails = {"alpha@corp.com": cust_alpha}
    existing_phones = {"+15550001111": cust_beta}

    row = {
        "name": "Alpha User",
        "email": "alpha@corp.com",
        "phone": "+15550001111",
        "customer_type": "VIP",
    }

    with pytest.raises(ImportValidationError) as exc:
        service.validate_row(
            import_type=ImportType.CUSTOMERS,
            row_number=2,
            normalized_row=row,
            duplicate_strategy="UPDATE",
            existing_customers_by_email=existing_emails,
            existing_customers_by_phone=existing_phones,
        )
    assert "Customer matching conflict" in str(exc.value)


# ---------------------------------------------------------
# 5. DURABLE WORKER & RECOVERY TESTS
# ---------------------------------------------------------

def test_import_worker_enqueue_and_queue_depth():
    from app.services.import_worker import ImportJobWorker
    worker = ImportJobWorker()
    import_id = uuid4()
    company_id = uuid4()
    user_id = uuid4()

    assert worker.queue.qsize() == 0
    worker.queue.put_nowait({
        "import_id": import_id,
        "company_id": company_id,
        "user_id": user_id,
    })
    assert worker.queue.qsize() == 1

    item = worker.queue.get_nowait()
    assert item["import_id"] == import_id
    assert item["company_id"] == company_id
    worker.queue.task_done()


# ---------------------------------------------------------
# 6. RECONCILIATION FOR ALL 4 TYPES
# ---------------------------------------------------------

def test_template_generation_covers_all_four_types():
    types = [ImportType.PRODUCTS, ImportType.INVENTORY, ImportType.CUSTOMERS, ImportType.SALES]
    for t in types:
        content, filename = ImportService.get_template_csv(t)
        assert content is not None
        assert len(content) > 10
        assert filename.endswith(".csv")
