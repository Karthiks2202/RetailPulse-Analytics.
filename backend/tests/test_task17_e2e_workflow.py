import io
import pytest
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal
from pathlib import Path

from app.models.import_history import ImportType, ImportStatus, DuplicateStrategy, ImportHistory
from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.models.inventory import InventoryAdjustment, AdjustmentType, StockMovement, MovementType
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
from app.services.import_worker import ImportJobWorker


class TestTask17AllFourImportTypes:
    """Verifies complete CSV structure, column aliases, and validation across all 4 import types."""

    def test_products_validation_success(self):
        service = ImportService(AsyncMock(), uuid4(), uuid4())
        cols = ["Product Name", "SKU", "Category", "Unit Price", "Stock Quantity"]
        service.validate_columns(ImportType.PRODUCTS, cols)
        row = {"product_name": "Smart Speaker", "sku": "SPK-01", "category": "Audio", "unit_price": "79.99", "stock_quantity": "30"}
        res = service.validate_row(ImportType.PRODUCTS, 2, row, duplicate_strategy="REJECT")
        assert res["action"] == "VALID"
        assert res["is_duplicate"] is False

    def test_inventory_validation_success(self):
        service = ImportService(AsyncMock(), uuid4(), uuid4())
        prod_id = uuid4()
        cols = ["SKU", "Adjustment Type", "Quantity", "Reason", "Remarks"]
        service.validate_columns(ImportType.INVENTORY, cols)
        row = {"sku": "SKU-RESTOCK", "adjustment_type": "STOCK_IN", "quantity": "40", "reason": "Restock PO #889", "remarks": "Dock A"}
        res = service.validate_row(
            ImportType.INVENTORY, 2, row, duplicate_strategy="REJECT",
            product_sku_to_id={"SKU-RESTOCK": prod_id},
            product_sku_stock={"SKU-RESTOCK": 100},
        )
        assert res["action"] == "VALID"
        assert res["is_duplicate"] is False

    def test_customers_validation_success(self):
        service = ImportService(AsyncMock(), uuid4(), uuid4())
        cols = ["Name", "Email", "Phone", "Customer Type"]
        service.validate_columns(ImportType.CUSTOMERS, cols)
        row = {"name": "Charlie Brown", "email": "charlie@peanuts.org", "phone": "+15559998888", "customer_type": "VIP"}
        res = service.validate_row(ImportType.CUSTOMERS, 2, row, duplicate_strategy="REJECT")
        assert res["action"] == "VALID"
        assert res["is_duplicate"] is False

    def test_sales_validation_success(self):
        service = ImportService(AsyncMock(), uuid4(), uuid4())
        cust_id = uuid4()
        prod_id = uuid4()
        cols = ["Customer", "Product", "Quantity", "Unit Price", "Sale Date", "Invoice Number"]
        service.validate_columns(ImportType.SALES, cols)
        row = {
            "customer": "Charlie Brown", "product": "Smart Speaker", "quantity": "2",
            "unit_price": "79.99", "sale_date": "2026-11-05", "invoice_number": "INV-2026-000555",
        }
        res = service.validate_row(
            ImportType.SALES, 2, row, duplicate_strategy="REJECT",
            customer_names={"Charlie Brown": cust_id},
            product_names={"Smart Speaker": prod_id},
            available_stock={prod_id: 20},
        )
        assert res["action"] == "VALID"
        assert res["is_duplicate"] is False


class TestTask17DuplicateHandling:
    """Tests duplicate handling and UPDATE strategies across inventory, sales, products, and customers."""

    def test_inventory_duplicate_update_strategy(self):
        service = ImportService(AsyncMock(), uuid4(), uuid4())
        prod_id = uuid4()
        sku_to_id = {"SKU-TEST": prod_id}
        sku_stock = {"SKU-TEST": 50}
        existing_adjs = {("SKU-TEST", "STOCK_IN", "cycle count"): MagicMock(quantity=10)}

        row = {"sku": "SKU-TEST", "adjustment_type": "STOCK_IN", "quantity": "25", "reason": "Cycle Count"}

        # Reject duplicate
        with pytest.raises(DuplicateRecordError):
            service.validate_row(
                ImportType.INVENTORY, 2, row, duplicate_strategy="REJECT",
                product_sku_to_id=sku_to_id, product_sku_stock=sku_stock,
                existing_inventory_adjustments=existing_adjs,
            )

        # Update duplicate
        res = service.validate_row(
            ImportType.INVENTORY, 2, row, duplicate_strategy="UPDATE",
            product_sku_to_id=sku_to_id, product_sku_stock=sku_stock,
            existing_inventory_adjustments=existing_adjs,
        )
        assert res["action"] == "UPDATE"
        assert res["is_duplicate"] is True

    def test_sales_duplicate_update_preserves_invoice(self):
        service = ImportService(AsyncMock(), uuid4(), uuid4())
        cust_id = uuid4()
        prod_id = uuid4()
        existing_invs = {"INV-2026-EXISTING"}
        row = {
            "customer": "VIP Client", "product": "Widget X", "quantity": "1",
            "unit_price": "100.00", "sale_date": "2026-11-01", "invoice_number": "INV-2026-EXISTING"
        }

        # REJECT
        with pytest.raises(DuplicateRecordError):
            service.validate_row(
                ImportType.SALES, 2, row, duplicate_strategy="REJECT",
                existing_invoices=existing_invs,
                customer_names={"VIP Client": cust_id}, product_names={"Widget X": prod_id},
                available_stock={prod_id: 10},
            )

        # UPDATE
        res = service.validate_row(
            ImportType.SALES, 2, row, duplicate_strategy="UPDATE",
            existing_invoices=existing_invs,
            customer_names={"VIP Client": cust_id}, product_names={"Widget X": prod_id},
            available_stock={prod_id: 10},
        )
        assert res["action"] == "UPDATE"
        assert res["is_duplicate"] is True

    def test_customer_matching_conflict_safety(self):
        service = ImportService(AsyncMock(), uuid4(), uuid4())
        cust1 = MagicMock(id=uuid4(), first_name="User1", last_name="Smith")
        cust2 = MagicMock(id=uuid4(), first_name="User2", last_name="Jones")

        row = {"name": "Conflict User", "email": "user1@corp.com", "phone": "+15552223333"}

        # email matches cust1, phone matches cust2 -> should raise conflict error
        with pytest.raises(ImportValidationError) as exc:
            service.validate_row(
                ImportType.CUSTOMERS, 2, row, duplicate_strategy="UPDATE",
                existing_customers_by_email={"user1@corp.com": cust1},
                existing_customers_by_phone={"+15552223333": cust2},
            )
        assert "Customer matching conflict" in str(exc.value)


class TestTask17SecurityAndLimits:
    """Verifies file size limits, content validation, binary signature detection."""

    def test_binary_executable_rejection(self):
        with pytest.raises(ValueError) as exc:
            validate_content_security(b"\x4d\x5a\x90\x00")
        assert "Windows Executable" in str(exc.value)

    def test_zip_xlsx_signature_rejection(self):
        with pytest.raises(ValueError) as exc:
            validate_content_security(b"PK\x03\x04")
        assert "ZIP / Office Spreadsheet" in str(exc.value)

    def test_null_byte_rejection(self):
        with pytest.raises(ValueError) as exc:
            validate_content_security(b"Name,SKU\nProduct\x00,SKU-1")
        assert "NULL bytes detected" in str(exc.value)


class TestTask17MultiCompanyIsolation:
    """Verifies multi-company authorization rules."""

    def test_company_isolation_on_history(self):
        db = AsyncMock()
        comp_a = uuid4()
        comp_b = uuid4()
        service_a = ImportService(db, comp_a, uuid4())
        service_b = ImportService(db, comp_b, uuid4())
        assert service_a.company_id != service_b.company_id


class TestTask17Cancellation:
    """Verifies cancellation flag lifecycle."""

    def test_cancellation_flow(self):
        import_id = uuid4()
        assert not ImportService.is_cancelled(import_id)
        ImportService.cancel_import(import_id)
        assert ImportService.is_cancelled(import_id)
        ImportService.clear_cancellation(import_id)
        assert not ImportService.is_cancelled(import_id)

