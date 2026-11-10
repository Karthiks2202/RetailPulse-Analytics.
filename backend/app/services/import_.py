import csv
import io
import re
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Optional, Set, Dict, Tuple, List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from app.models.import_history import ImportHistory, ImportError, ImportStatus, ImportType, DuplicateStrategy
from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem, SalesChannel, PaymentMethod, SaleStatus, PaymentStatus
from app.models.invoice_sequence import InvoiceSequence
from app.models.inventory import StockMovement, InventoryAdjustment, AdjustmentType, MovementType
from app.models.notification import NotificationType, NotificationPriority, NotificationResourceType
from app.crud.import_history import import_history as import_history_crud
from app.services.notification import notification_service

logger = logging.getLogger("retailpulse")


class ImportValidationError(Exception):
    def __init__(self, row_number: int, field: str | None, message: str, raw_data: str | None = None, error_type: str = "VALIDATION_ERROR"):
        self.row_number = row_number
        self.field = field
        self.message = message
        self.raw_data = raw_data
        self.error_type = error_type
        super().__init__(message)


class DuplicateRecordError(Exception):
    def __init__(self, row_number: int, field: str | None, message: str, raw_data: str | None = None, error_type: str = "DUPLICATE_ERROR"):
        self.row_number = row_number
        self.field = field
        self.message = message
        self.raw_data = raw_data
        self.error_type = error_type
        super().__init__(message)


class ImportService:
    _cancelled_imports: Set[UUID] = set()

    IMPORT_CONFIG = {
        ImportType.PRODUCTS: {
            "required_columns": ["Product Name", "SKU", "Category", "Unit Price", "Stock Quantity"],
            "column_map": {
                "Product Name": "product_name",
                "SKU": "sku",
                "Category": "category",
                "Unit Price": "unit_price",
                "Stock Quantity": "stock_quantity",
            },
            "aliases": {
                "product_name": ["product name", "product_name", "productname", "name", "title", "product", "item name", "item_name", "item", "description", "product title"],
                "sku": ["sku", "product sku", "item sku", "code", "product code", "item code", "id", "product id"],
                "category": ["category", "category name", "cat", "group", "type"],
                "unit_price": ["unit price", "unit_price", "price", "cost", "unit cost", "rate", "selling price", "amount"],
                "stock_quantity": ["stock quantity", "stock_quantity", "stock", "quantity", "qty", "count", "inventory", "stock level"],
            },
        },
        ImportType.INVENTORY: {
            "required_columns": ["SKU", "Adjustment Type", "Quantity", "Reason"],
            "column_map": {
                "SKU": "sku",
                "Adjustment Type": "adjustment_type",
                "Quantity": "quantity",
                "Reason": "reason",
                "Remarks": "remarks",
            },
            "aliases": {
                "sku": ["sku", "product sku", "product_sku", "item sku", "code", "product code", "item code"],
                "adjustment_type": ["adjustment type", "adjustment_type", "type", "action", "movement type", "movement_type"],
                "quantity": ["quantity", "qty", "count", "amount", "units", "adjustment quantity"],
                "reason": ["reason", "notes", "adjustment reason", "description", "reason for adjustment"],
                "remarks": ["remarks", "remark", "comment", "comments", "internal notes"],
            },
        },
        ImportType.CUSTOMERS: {
            "required_columns": ["Name", "Email", "Phone"],
            "column_map": {
                "Name": "name",
                "Email": "email",
                "Phone": "phone",
                "Customer Type": "customer_type",
            },
            "aliases": {
                "name": ["name", "customer name", "customer_name", "full name", "client name", "client", "contact name", "customer", "first name"],
                "email": ["email", "email address", "email_address", "mail", "e mail"],
                "phone": ["phone", "phone number", "phone_number", "mobile", "contact", "tel", "telephone", "cell"],
                "customer_type": ["customer type", "customer_type", "type", "segment", "tier"],
            },
        },
        ImportType.SALES: {
            "required_columns": ["Customer", "Product", "Quantity", "Unit Price", "Sale Date", "Invoice Number"],
            "column_map": {
                "Customer": "customer",
                "Product": "product",
                "Quantity": "quantity",
                "Unit Price": "unit_price",
                "Sale Date": "sale_date",
                "Invoice Number": "invoice_number",
            },
            "aliases": {
                "customer": ["customer", "customer name", "customer_name", "client", "client name", "buyer"],
                "product": ["product", "product name", "product_name", "item", "item name", "title"],
                "quantity": ["quantity", "qty", "count", "amount", "units", "items count"],
                "unit_price": ["unit price", "unit_price", "price", "rate", "unit cost", "selling price"],
                "sale_date": ["sale date", "sale_date", "date", "transaction date", "created at", "timestamp", "order date"],
                "invoice_number": ["invoice number", "invoice_number", "invoice no", "invoice no.", "transaction number", "transaction id", "txn id", "ref number", "reference number"],
            },
        },
    }

    def __init__(self, db: AsyncSession, company_id: UUID, uploaded_by: UUID | None):
        self.db = db
        self.company_id = company_id
        self.uploaded_by = uploaded_by

    @classmethod
    def cancel_import(cls, import_id: UUID) -> bool:
        cls._cancelled_imports.add(import_id)
        return True

    @classmethod
    def is_cancelled(cls, import_id: UUID) -> bool:
        return import_id in cls._cancelled_imports

    @classmethod
    def clear_cancellation(cls, import_id: UUID) -> None:
        cls._cancelled_imports.discard(import_id)

    @staticmethod
    def _clean_header(name: str) -> str:
        if not name:
            return ""
        cleaned = name.strip().strip('"').strip("'").lstrip("\ufeff").lower()
        cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()

    def _find_matching_header(self, import_type: ImportType, target_req: str, columns: list[str]) -> str | None:
        target_clean = self._clean_header(target_req)
        clean_cols = {self._clean_header(c): c for c in columns if c}
        if target_clean in clean_cols:
            return clean_cols[target_clean]

        field = self.IMPORT_CONFIG[import_type]["column_map"].get(target_req)
        aliases = self.IMPORT_CONFIG[import_type].get("aliases", {}).get(field, [])
        for alias in aliases:
            alias_clean = self._clean_header(alias)
            if alias_clean in clean_cols:
                return clean_cols[alias_clean]
        return None

    def parse_csv(self, file_content: bytes) -> tuple[list[str], list[dict[str, str]]]:
        try:
            text = file_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = file_content.decode("latin-1")
            except UnicodeDecodeError:
                text = file_content.decode("utf-8", errors="replace")

        lines = [line for line in text.splitlines() if line.strip()]
        if not lines:
            return [], []

        sample = "\n".join(lines[:10])
        delimiter = ","
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
            delimiter = dialect.delimiter
        except Exception:
            header_line = lines[0]
            if ";" in header_line and "," not in header_line:
                delimiter = ";"
            elif "\t" in header_line:
                delimiter = "\t"
            elif "|" in header_line:
                delimiter = "|"

        reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter=delimiter)
        columns = [c.strip().strip('"').strip("'").lstrip("\ufeff") for c in (reader.fieldnames or []) if c]
        rows = []
        for r in reader:
            clean_r = {}
            for k, v in r.items():
                if k:
                    clean_k = k.strip().strip('"').strip("'").lstrip("\ufeff")
                    clean_r[clean_k] = v.strip() if isinstance(v, str) else ""
            rows.append(clean_r)
        return columns, rows

    def validate_columns(self, import_type: ImportType, columns: list[str]) -> None:
        required = self.IMPORT_CONFIG[import_type]["required_columns"]
        missing = []
        for col in required:
            matched = self._find_matching_header(import_type, col, columns)
            if not matched:
                field = self.IMPORT_CONFIG[import_type]["column_map"].get(col)
                aliases = self.IMPORT_CONFIG[import_type].get("aliases", {}).get(field, [])
                missing.append(f"'{col}' (accepted names: {', '.join(aliases[:4])})")
        if missing:
            raise ValueError(f"Missing required column: {'; '.join(missing)}")

    def normalize_row(self, import_type: ImportType, row: dict[str, str]) -> dict[str, Any]:
        column_map = self.IMPORT_CONFIG[import_type]["column_map"]
        normalized: dict[str, Any] = {}
        columns = list(row.keys())
        for csv_col, field in column_map.items():
            matched_header = self._find_matching_header(import_type, csv_col, columns)
            value = row.get(matched_header, "").strip() if matched_header else ""
            normalized[field] = value
        return normalized

    def validate_row(
        self,
        import_type: ImportType,
        row_number: int,
        normalized_row: dict[str, Any],
        duplicate_strategy: str = "REJECT",
        existing_skus: Optional[set[str]] = None,
        existing_emails: Optional[set[str]] = None,
        existing_phones: Optional[set[str]] = None,
        existing_invoices: Optional[set[str]] = None,
        customer_names: Optional[dict[str, UUID]] = None,
        product_names: Optional[dict[str, UUID]] = None,
        available_stock: Optional[dict[UUID, int]] = None,
        product_sku_to_id: Optional[dict[str, UUID]] = None,
        product_sku_stock: Optional[dict[str, int]] = None,
        seen_skus_in_file: Optional[set[str]] = None,
        seen_emails_in_file: Optional[set[str]] = None,
        seen_phones_in_file: Optional[set[str]] = None,
        seen_invoices_in_file: Optional[set[str]] = None,
        seen_inventory_skus_in_file: Optional[set[str]] = None,
    ) -> dict[str, Any]:
        """
        Validates a single normalized row.
        Returns a dict: {"action": "VALID" | "SKIP" | "UPDATE", "is_duplicate": bool}
        Raises ImportValidationError or DuplicateRecordError when invalid or rejected.
        """
        existing_skus = existing_skus if existing_skus is not None else set()
        existing_emails = existing_emails if existing_emails is not None else set()
        existing_phones = existing_phones if existing_phones is not None else set()
        existing_invoices = existing_invoices if existing_invoices is not None else set()
        customer_names = customer_names if customer_names is not None else {}
        product_names = product_names if product_names is not None else {}
        available_stock = available_stock if available_stock is not None else {}
        product_sku_to_id = product_sku_to_id if product_sku_to_id is not None else {}
        product_sku_stock = product_sku_stock if product_sku_stock is not None else {}
        seen_skus_in_file = seen_skus_in_file if seen_skus_in_file is not None else set()
        seen_emails_in_file = seen_emails_in_file if seen_emails_in_file is not None else set()
        seen_phones_in_file = seen_phones_in_file if seen_phones_in_file is not None else set()
        seen_invoices_in_file = seen_invoices_in_file if seen_invoices_in_file is not None else set()
        seen_inventory_skus_in_file = seen_inventory_skus_in_file if seen_inventory_skus_in_file is not None else set()

        strategy = (duplicate_strategy or "REJECT").upper()

        if import_type == ImportType.PRODUCTS:
            sku = normalized_row.get("sku", "").strip()
            product_name = normalized_row.get("product_name", "").strip()
            if not sku:
                raise ImportValidationError(row_number, "sku", "SKU is required", str(normalized_row), error_type="REQUIRED_FIELD")
            if not product_name:
                raise ImportValidationError(row_number, "product_name", "Product Name is required", str(normalized_row), error_type="REQUIRED_FIELD")

            is_duplicate = False
            dup_reason = ""
            if sku in seen_skus_in_file:
                is_duplicate = True
                dup_reason = f"Duplicate SKU '{sku}' found within uploaded file"
            elif sku in existing_skus:
                is_duplicate = True
                dup_reason = f"SKU '{sku}' already exists in the database"

            if is_duplicate:
                if strategy == "REJECT":
                    raise DuplicateRecordError(row_number, "sku", dup_reason, str(normalized_row), error_type="DUPLICATE_RECORD")
                elif strategy == "SKIP":
                    seen_skus_in_file.add(sku)
                    return {"action": "SKIP", "is_duplicate": True, "reason": dup_reason}
                elif strategy == "UPDATE":
                    seen_skus_in_file.add(sku)
                    # continue validation for update values

            seen_skus_in_file.add(sku)

            try:
                price = Decimal(str(normalized_row.get("unit_price", "0")))
            except InvalidOperation:
                raise ImportValidationError(row_number, "unit_price", "Invalid Unit Price: must be a valid number", str(normalized_row), error_type="INVALID_DATA_TYPE")
            if price <= 0:
                raise ImportValidationError(row_number, "unit_price", "Unit Price must be greater than zero", str(normalized_row), error_type="INVALID_VALUE")

            try:
                stock = int(normalized_row.get("stock_quantity", "0"))
            except (ValueError, TypeError):
                raise ImportValidationError(row_number, "stock_quantity", "Invalid Stock Quantity: must be an integer", str(normalized_row), error_type="INVALID_DATA_TYPE")
            if stock < 0:
                raise ImportValidationError(row_number, "stock_quantity", "Stock Quantity cannot be negative", str(normalized_row), error_type="INVALID_VALUE")

            return {"action": "UPDATE" if (is_duplicate and strategy == "UPDATE") else "VALID", "is_duplicate": is_duplicate}

        elif import_type == ImportType.INVENTORY:
            sku = normalized_row.get("sku", "").strip()
            adj_type_raw = normalized_row.get("adjustment_type", "").strip()
            qty_raw = normalized_row.get("quantity", "").strip()
            reason = normalized_row.get("reason", "").strip()

            if not sku:
                raise ImportValidationError(row_number, "sku", "Product SKU is required", str(normalized_row), error_type="REQUIRED_FIELD")
            if sku not in product_sku_to_id:
                raise ImportValidationError(row_number, "sku", f"Product with SKU '{sku}' does not exist in catalog", str(normalized_row), error_type="FOREIGN_KEY_NOT_FOUND")

            if not adj_type_raw:
                raise ImportValidationError(row_number, "adjustment_type", "Adjustment Type is required", str(normalized_row), error_type="REQUIRED_FIELD")

            clean_type = adj_type_raw.upper().replace(" ", "_")
            valid_types = {
                "STOCK_IN": AdjustmentType.STOCK_IN,
                "IN": AdjustmentType.STOCK_IN,
                "ADD": AdjustmentType.STOCK_IN,
                "STOCK_OUT": AdjustmentType.STOCK_OUT,
                "OUT": AdjustmentType.STOCK_OUT,
                "REMOVE": AdjustmentType.STOCK_OUT,
                "MANUAL_ADJUSTMENT": AdjustmentType.MANUAL_ADJUSTMENT,
                "SET": AdjustmentType.MANUAL_ADJUSTMENT,
                "ADJUSTMENT": AdjustmentType.MANUAL_ADJUSTMENT,
            }
            if clean_type not in valid_types:
                raise ImportValidationError(row_number, "adjustment_type", f"Invalid Adjustment Type '{adj_type_raw}'. Allowed: STOCK_IN, STOCK_OUT, MANUAL_ADJUSTMENT", str(normalized_row), error_type="INVALID_VALUE")

            try:
                qty = int(qty_raw)
            except (ValueError, TypeError):
                raise ImportValidationError(row_number, "quantity", "Invalid Quantity: must be a positive integer", str(normalized_row), error_type="INVALID_DATA_TYPE")
            if qty <= 0:
                raise ImportValidationError(row_number, "quantity", "Quantity must be greater than zero", str(normalized_row), error_type="INVALID_VALUE")

            if not reason:
                raise ImportValidationError(row_number, "reason", "Reason for inventory adjustment is required", str(normalized_row), error_type="REQUIRED_FIELD")

            # Duplicate SKU check within same import file
            is_duplicate = False
            dup_reason = ""
            if sku in seen_inventory_skus_in_file:
                is_duplicate = True
                dup_reason = f"Duplicate inventory adjustment for SKU '{sku}' in uploaded file"

            if is_duplicate:
                if strategy == "REJECT":
                    raise DuplicateRecordError(row_number, "sku", dup_reason, str(normalized_row), error_type="DUPLICATE_RECORD")
                elif strategy == "SKIP":
                    seen_inventory_skus_in_file.add(sku)
                    return {"action": "SKIP", "is_duplicate": True, "reason": dup_reason}

            seen_inventory_skus_in_file.add(sku)

            current_stock = product_sku_stock.get(sku, 0)
            if valid_types[clean_type] == AdjustmentType.STOCK_OUT and qty > current_stock:
                raise ImportValidationError(row_number, "quantity", f"Insufficient stock for SKU '{sku}'. Available stock: {current_stock}, requested removal: {qty}", str(normalized_row), error_type="INSUFFICIENT_STOCK")

            return {"action": "UPDATE" if (is_duplicate and strategy == "UPDATE") else "VALID", "is_duplicate": is_duplicate}

        elif import_type == ImportType.CUSTOMERS:
            name = normalized_row.get("name", "").strip()
            email = normalized_row.get("email", "").strip()
            phone = normalized_row.get("phone", "").strip()

            if not name:
                raise ImportValidationError(row_number, "name", "Customer Name is required", str(normalized_row), error_type="REQUIRED_FIELD")
            if not email:
                raise ImportValidationError(row_number, "email", "Email is required", str(normalized_row), error_type="REQUIRED_FIELD")
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
                raise ImportValidationError(row_number, "email", f"Invalid email format: '{email}'", str(normalized_row), error_type="INVALID_DATA_TYPE")

            if not phone:
                raise ImportValidationError(row_number, "phone", "Phone number is required", str(normalized_row), error_type="REQUIRED_FIELD")
            if not re.match(r"^\+?[\d\s()-]{7,}$", phone):
                raise ImportValidationError(row_number, "phone", f"Invalid phone number format: '{phone}'", str(normalized_row), error_type="INVALID_DATA_TYPE")

            is_duplicate = False
            dup_reason = ""
            if email in seen_emails_in_file:
                is_duplicate = True
                dup_reason = f"Duplicate email '{email}' in uploaded file"
            elif email in existing_emails:
                is_duplicate = True
                dup_reason = f"Customer with email '{email}' already exists"
            elif phone in seen_phones_in_file:
                is_duplicate = True
                dup_reason = f"Duplicate phone '{phone}' in uploaded file"
            elif phone in existing_phones:
                is_duplicate = True
                dup_reason = f"Customer with phone '{phone}' already exists"

            if is_duplicate:
                if strategy == "REJECT":
                    raise DuplicateRecordError(row_number, "email" if "email" in dup_reason else "phone", dup_reason, str(normalized_row), error_type="DUPLICATE_RECORD")
                elif strategy == "SKIP":
                    seen_emails_in_file.add(email)
                    seen_phones_in_file.add(phone)
                    return {"action": "SKIP", "is_duplicate": True, "reason": dup_reason}

            seen_emails_in_file.add(email)
            seen_phones_in_file.add(phone)

            return {"action": "UPDATE" if (is_duplicate and strategy == "UPDATE") else "VALID", "is_duplicate": is_duplicate}

        elif import_type == ImportType.SALES:
            customer_name = normalized_row.get("customer", "").strip()
            product_name = normalized_row.get("product", "").strip()
            quantity_raw = normalized_row.get("quantity", "").strip()
            unit_price_raw = normalized_row.get("unit_price", "").strip()
            sale_date_raw = normalized_row.get("sale_date", "").strip()
            invoice_number = normalized_row.get("invoice_number", "").strip()

            if not customer_name:
                raise ImportValidationError(row_number, "customer", "Customer Name is required", str(normalized_row), error_type="REQUIRED_FIELD")
            if not product_name:
                raise ImportValidationError(row_number, "product", "Product Name is required", str(normalized_row), error_type="REQUIRED_FIELD")
            if not invoice_number:
                raise ImportValidationError(row_number, "invoice_number", "Invoice Number is required", str(normalized_row), error_type="REQUIRED_FIELD")

            # Duplicate invoice detection
            is_duplicate = False
            dup_reason = ""
            if invoice_number in existing_invoices:
                is_duplicate = True
                dup_reason = f"Invoice number '{invoice_number}' already exists in database"

            if is_duplicate:
                if strategy == "REJECT":
                    raise DuplicateRecordError(row_number, "invoice_number", dup_reason, str(normalized_row), error_type="DUPLICATE_RECORD")
                elif strategy == "SKIP":
                    seen_invoices_in_file.add(invoice_number)
                    return {"action": "SKIP", "is_duplicate": True, "reason": dup_reason}

            seen_invoices_in_file.add(invoice_number)

            try:
                quantity = int(quantity_raw)
            except (TypeError, ValueError):
                raise ImportValidationError(row_number, "quantity", "Invalid Quantity: must be a positive integer", str(normalized_row), error_type="INVALID_DATA_TYPE")
            if quantity <= 0:
                raise ImportValidationError(row_number, "quantity", "Quantity must be greater than zero", str(normalized_row), error_type="INVALID_VALUE")

            try:
                unit_price = Decimal(str(unit_price_raw))
            except InvalidOperation:
                raise ImportValidationError(row_number, "unit_price", "Invalid Unit Price: must be a valid number", str(normalized_row), error_type="INVALID_DATA_TYPE")
            if unit_price < 0:
                raise ImportValidationError(row_number, "unit_price", "Unit Price cannot be negative", str(normalized_row), error_type="INVALID_VALUE")

            try:
                datetime.strptime(sale_date_raw, "%Y-%m-%d")
            except Exception:
                raise ImportValidationError(row_number, "sale_date", "Invalid Sale Date format. Expected YYYY-MM-DD", str(normalized_row), error_type="INVALID_DATA_TYPE")

            customer_id = customer_names.get(customer_name)
            if not customer_id:
                raise ImportValidationError(row_number, "customer", f"Customer not found: '{customer_name}'", str(normalized_row), error_type="FOREIGN_KEY_NOT_FOUND")

            product_id = product_names.get(product_name)
            if not product_id:
                raise ImportValidationError(row_number, "product", f"Product not found: '{product_name}'", str(normalized_row), error_type="FOREIGN_KEY_NOT_FOUND")

            available = available_stock.get(product_id, 0)
            if quantity > available:
                raise ImportValidationError(row_number, "quantity", f"Quantity ({quantity}) exceeds available product stock ({available})", str(normalized_row), error_type="INSUFFICIENT_STOCK")
            available_stock[product_id] -= quantity

            return {"action": "VALID", "is_duplicate": is_duplicate}

        return {"action": "VALID", "is_duplicate": False}

    async def _get_existing_skus(self) -> set[str]:
        result = await self.db.execute(select(Product.sku).where(Product.company_id == self.company_id))
        return {row.sku for row in result.all() if row.sku}

    async def _get_product_sku_maps(self) -> Tuple[Dict[str, UUID], Dict[str, int]]:
        result = await self.db.execute(select(Product.id, Product.sku, Product.stock_quantity).where(Product.company_id == self.company_id))
        sku_to_id = {}
        sku_stock = {}
        for row in result.all():
            if row.sku:
                sku_to_id[row.sku] = row.id
                sku_stock[row.sku] = row.stock_quantity or 0
        return sku_to_id, sku_stock

    async def _get_existing_customer_unique_values(self) -> tuple[set[str], set[str]]:
        result = await self.db.execute(select(Customer.email, Customer.phone).where(Customer.company_id == self.company_id, Customer.is_deleted == False))
        emails: set[str] = set()
        phones: set[str] = set()
        for row in result.all():
            if row.email:
                emails.add(row.email)
            if row.phone:
                phones.add(row.phone)
        return emails, phones

    async def _get_existing_invoices(self) -> set[str]:
        result = await self.db.execute(select(Sale.invoice_number).where(Sale.company_id == self.company_id))
        return {row.invoice_number for row in result.all() if row.invoice_number}

    async def _get_customer_names(self) -> dict[str, UUID]:
        result = await self.db.execute(select(Customer.first_name, Customer.last_name, Customer.id).where(Customer.company_id == self.company_id, Customer.is_deleted == False))
        names: dict[str, UUID] = {}
        for row in result.all():
            name = f"{row.first_name} {row.last_name}".strip()
            if name:
                names[name] = row.id
        return names

    async def _get_product_names(self) -> dict[str, UUID]:
        result = await self.db.execute(select(Product.name, Product.id).where(Product.company_id == self.company_id))
        return {row.name: row.id for row in result.all() if row.name}

    async def _get_available_stock(self) -> dict[UUID, int]:
        result = await self.db.execute(select(Product.id, Product.stock_quantity, Product.reserved_stock).where(Product.company_id == self.company_id))
        stock: dict[UUID, int] = {}
        for row in result.all():
            stock[row.id] = max((row.stock_quantity or 0) - (row.reserved_stock or 0), 0)
        return stock

    async def create_import_history(self, import_type: ImportType, filename: str, total_records: int, duplicate_strategy: str = "REJECT", commit: bool = True) -> ImportHistory:
        return await import_history_crud.create(self.db, self.company_id, import_type, filename, self.uploaded_by, total_records, duplicate_strategy=duplicate_strategy, commit=commit)

    async def get_import_history(self, import_id: UUID) -> ImportHistory | None:
        return await import_history_crud.get(self.db, import_id, self.company_id)

    async def list_import_history(self, skip: int = 0, limit: int = 100, import_type: ImportType | None = None, status: ImportStatus | None = None) -> tuple[list[ImportHistory], int]:
        return await import_history_crud.list(self.db, self.company_id, skip=skip, limit=limit, import_type=import_type, status=status)

    async def get_import_errors(self, import_id: UUID) -> list[dict]:
        errors = await import_history_crud.get_errors(self.db, import_id, self.company_id)
        return [
            {
                "id": str(e.id),
                "import_id": str(e.import_id),
                "row_number": e.row_number,
                "field": e.field,
                "error_type": e.error_type or "VALIDATION_ERROR",
                "error_message": e.error_message,
                "raw_data": e.raw_data,
                "processing_status": e.processing_status or "FAILED",
            }
            for e in errors
        ]

    async def validate_import(self, import_type: ImportType, file_content: bytes, filename: str, import_id: UUID | None = None, duplicate_strategy: str = "REJECT") -> dict:
        columns, rows = self.parse_csv(file_content)
        errors: list[dict[str, Any]] = []

        try:
            self.validate_columns(import_type, columns)
        except ValueError as e:
            errors.append({
                "row_number": 1,
                "field": "Header",
                "error_type": "REQUIRED_COLUMNS_MISSING",
                "error_message": str(e),
                "raw_data": f"Columns found: {', '.join(columns)}" if columns else "Empty file or no columns found",
                "processing_status": "FAILED",
            })
            return {
                "import_id": str(import_id) if import_id else "00000000-0000-0000-0000-000000000000",
                "import_type": import_type.value,
                "filename": filename,
                "duplicate_strategy": duplicate_strategy,
                "total_records": len(rows),
                "columns": columns,
                "preview_rows": [],
                "valid_records": 0,
                "invalid_records": len(rows) or 1,
                "duplicate_records": 0,
                "errors": errors,
                "status": ImportStatus.FAILED.value,
            }

        valid_rows = 0
        duplicate_rows = 0
        invalid_rows = 0

        existing_skus = await self._get_existing_skus() if import_type == ImportType.PRODUCTS else set()
        product_sku_to_id, product_sku_stock = await self._get_product_sku_maps() if import_type == ImportType.INVENTORY else ({}, {})
        existing_emails, existing_phones = await self._get_existing_customer_unique_values() if import_type == ImportType.CUSTOMERS else (set(), set())
        customer_names = await self._get_customer_names() if import_type == ImportType.SALES else {}
        product_names = await self._get_product_names() if import_type == ImportType.SALES else {}
        available_stock = await self._get_available_stock() if import_type == ImportType.SALES else {}
        existing_invoices = await self._get_existing_invoices() if import_type == ImportType.SALES else set()

        seen_skus = set()
        seen_emails = set()
        seen_phones = set()
        seen_invoices = set()
        seen_inventory_skus = set()

        preview_rows = []
        for idx, row in enumerate(rows, start=2):
            normalized = self.normalize_row(import_type, row)
            try:
                res = self.validate_row(
                    import_type=import_type,
                    row_number=idx,
                    normalized_row=normalized,
                    duplicate_strategy=duplicate_strategy,
                    existing_skus=existing_skus,
                    existing_emails=existing_emails,
                    existing_phones=existing_phones,
                    existing_invoices=existing_invoices,
                    customer_names=customer_names,
                    product_names=product_names,
                    available_stock=available_stock,
                    product_sku_to_id=product_sku_to_id,
                    product_sku_stock=product_sku_stock,
                    seen_skus_in_file=seen_skus,
                    seen_emails_in_file=seen_emails,
                    seen_phones_in_file=seen_phones,
                    seen_invoices_in_file=seen_invoices,
                    seen_inventory_skus_in_file=seen_inventory_skus,
                )
                if res.get("is_duplicate"):
                    duplicate_rows += 1
                if res.get("action") == "SKIP":
                    pass
                else:
                    valid_rows += 1
            except DuplicateRecordError as e:
                duplicate_rows += 1
                invalid_rows += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_type": e.error_type,
                    "error_message": e.message,
                    "raw_data": e.raw_data or str(normalized),
                    "processing_status": "REJECTED",
                })
            except ImportValidationError as e:
                invalid_rows += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_type": e.error_type,
                    "error_message": e.message,
                    "raw_data": e.raw_data or str(normalized),
                    "processing_status": "FAILED",
                })

            if len(preview_rows) < 10:
                preview_rows.append(normalized)

        return {
            "import_id": str(import_id) if import_id else "00000000-0000-0000-0000-000000000000",
            "import_type": import_type.value,
            "filename": filename,
            "duplicate_strategy": duplicate_strategy,
            "total_records": len(rows),
            "columns": columns,
            "preview_rows": preview_rows,
            "valid_records": valid_rows,
            "invalid_records": invalid_rows,
            "duplicate_records": duplicate_rows,
            "errors": errors,
            "status": ImportStatus.VALIDATING.value,
        }

    async def process_import(
        self,
        import_type: ImportType,
        file_content: bytes,
        filename: str,
        import_id: UUID | None = None,
        duplicate_strategy: str = "REJECT",
    ) -> dict:
        columns, rows = self.parse_csv(file_content)
        self.validate_columns(import_type, columns)

        started_at = datetime.utcnow()
        history = None
        if import_id:
            history = await self.get_import_history(import_id)
            if not history:
                raise ValueError(f"Import history not found: {import_id}")
            history.started_at = started_at
            history.duplicate_strategy = duplicate_strategy
            await import_history_crud.update_status(self.db, history, ImportStatus.PROCESSING, started_at=started_at, commit=True)
        else:
            history = await self.create_import_history(import_type, filename, len(rows), duplicate_strategy=duplicate_strategy, commit=True)
            history.started_at = started_at
            await import_history_crud.update_status(self.db, history, ImportStatus.PROCESSING, started_at=started_at, commit=True)

        self.clear_cancellation(history.id)

        # Notify start
        try:
            await self._create_import_notification(history, ImportStatus.PROCESSING)
        except Exception as e:
            logger.warning(f"Failed to send import started notification: {e}")

        existing_skus = await self._get_existing_skus() if import_type == ImportType.PRODUCTS else set()
        product_sku_to_id, product_sku_stock = await self._get_product_sku_maps() if import_type == ImportType.INVENTORY else ({}, {})
        existing_emails, existing_phones = await self._get_existing_customer_unique_values() if import_type == ImportType.CUSTOMERS else (set(), set())
        customer_names = await self._get_customer_names() if import_type == ImportType.SALES else {}
        product_names = await self._get_product_names() if import_type == ImportType.SALES else {}
        available_stock = await self._get_available_stock() if import_type == ImportType.SALES else {}
        existing_invoices = await self._get_existing_invoices() if import_type == ImportType.SALES else set()

        seen_skus = set()
        seen_emails = set()
        seen_phones = set()
        seen_invoices = set()
        seen_inventory_skus = set()

        valid_rows: list[tuple[int, dict[str, Any], str]] = []  # (row_num, data, action)
        errors: list[dict[str, Any]] = []
        duplicate_count = 0
        skipped_count = 0
        invalid_count = 0

        for idx, row in enumerate(rows, start=2):
            normalized = self.normalize_row(import_type, row)
            try:
                res = self.validate_row(
                    import_type=import_type,
                    row_number=idx,
                    normalized_row=normalized,
                    duplicate_strategy=duplicate_strategy,
                    existing_skus=existing_skus,
                    existing_emails=existing_emails,
                    existing_phones=existing_phones,
                    existing_invoices=existing_invoices,
                    customer_names=customer_names,
                    product_names=product_names,
                    available_stock=available_stock,
                    product_sku_to_id=product_sku_to_id,
                    product_sku_stock=product_sku_stock,
                    seen_skus_in_file=seen_skus,
                    seen_emails_in_file=seen_emails,
                    seen_phones_in_file=seen_phones,
                    seen_invoices_in_file=seen_invoices,
                    seen_inventory_skus_in_file=seen_inventory_skus,
                )
                if res.get("is_duplicate"):
                    duplicate_count += 1
                if res.get("action") == "SKIP":
                    skipped_count += 1
                else:
                    valid_rows.append((idx, normalized, res.get("action", "VALID")))
            except DuplicateRecordError as e:
                duplicate_count += 1
                invalid_count += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_type": e.error_type,
                    "error_message": e.message,
                    "raw_data": e.raw_data or str(normalized),
                    "processing_status": "REJECTED",
                })
            except ImportValidationError as e:
                invalid_count += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_type": e.error_type,
                    "error_message": e.message,
                    "raw_data": e.raw_data or str(normalized),
                    "processing_status": "FAILED",
                })

        successful = 0
        failed = invalid_count
        batch_size = 25
        was_cancelled = False

        if import_type == ImportType.SALES:
            sales_groups: dict[str, list[tuple[int, dict[str, Any]]]] = {}
            for original_idx, normalized, action in valid_rows:
                inv_num = normalized.get("invoice_number", f"AUTO_GRP_{original_idx}")
                sales_groups.setdefault(inv_num, []).append((original_idx, normalized))

            for inv_num, items_group in sales_groups.items():
                if self.is_cancelled(history.id):
                    was_cancelled = True
                    break

                try:
                    await self._insert_sales_group(inv_num, items_group, customer_names, product_names)
                    await self.db.commit()
                    successful += len(items_group)
                except Exception as e:
                    await self.db.rollback()
                    failed += len(items_group)
                    logger.exception(f"Failed to import sales group for invoice {inv_num}: {e}")
                    for original_idx, normalized in items_group:
                        errors.append({
                            "row_number": original_idx,
                            "field": None,
                            "error_type": "PROCESSING_ERROR",
                            "error_message": "Unable to process sales record. Transaction rolled back.",
                            "raw_data": str(normalized),
                            "processing_status": "FAILED",
                        })

                await import_history_crud.update_status(
                    self.db, history, ImportStatus.PROCESSING,
                    successful=successful, failed=failed, duplicates=duplicate_count, skipped=skipped_count, commit=True
                )
        else:
            for batch_start in range(0, len(valid_rows), batch_size):
                if self.is_cancelled(history.id):
                    was_cancelled = True
                    break

                batch = valid_rows[batch_start:batch_start + batch_size]
                try:
                    for original_idx, normalized, action in batch:
                        if import_type == ImportType.PRODUCTS:
                            await self._insert_or_update_product(normalized, action)
                        elif import_type == ImportType.INVENTORY:
                            await self._insert_inventory_adjustment(normalized, action, product_sku_to_id)
                        elif import_type == ImportType.CUSTOMERS:
                            await self._insert_or_update_customer(normalized, action)
                    await self.db.commit()
                    successful += len(batch)
                except Exception as e:
                    await self.db.rollback()
                    failed += len(batch)
                    logger.exception(f"Batch insert failed during {import_type.value} import: {e}")
                    for original_idx, normalized, action in batch:
                        errors.append({
                            "row_number": original_idx,
                            "field": None,
                            "error_type": "PROCESSING_ERROR",
                            "error_message": "Unable to process record into database. Record failed.",
                            "raw_data": str(normalized),
                            "processing_status": "FAILED",
                        })

                await import_history_crud.update_status(
                    self.db, history, ImportStatus.PROCESSING,
                    successful=successful, failed=failed, duplicates=duplicate_count, skipped=skipped_count, commit=True
                )

        # Store all captured errors
        for error in errors:
            await import_history_crud.add_error(
                self.db,
                import_id=history.id,
                row_number=error["row_number"],
                error_message=error["error_message"],
                field=error.get("field"),
                error_type=error.get("error_type", "VALIDATION_ERROR"),
                raw_data=error.get("raw_data"),
                processing_status=error.get("processing_status", "FAILED"),
                commit=False
            )

        completed_at = datetime.utcnow()
        duration_seconds = max(0.0, (completed_at - started_at).total_seconds())

        if was_cancelled:
            final_status = ImportStatus.CANCELLED
        elif failed == 0 and duplicate_count == 0 and invalid_count == 0:
            final_status = ImportStatus.COMPLETED
        elif successful == 0 and failed > 0:
            final_status = ImportStatus.FAILED
        else:
            final_status = ImportStatus.COMPLETED_WITH_ERRORS

        await import_history_crud.update_status(
            self.db,
            history,
            status=final_status,
            successful=successful,
            failed=failed,
            duplicates=duplicate_count,
            skipped=skipped_count,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration_seconds,
            commit=True,
        )
        await self.db.refresh(history)
        self.clear_cancellation(history.id)

        # Notification for completion
        try:
            await self._create_import_notification(history, final_status)
        except Exception as e:
            logger.warning(f"Failed to send import completion notification: {e}")

        # Data Quality & Reconciliation Integration (Requirement 12)
        reconciliation_result = None
        if final_status in (ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_ERRORS) and import_type in (ImportType.INVENTORY, ImportType.PRODUCTS, ImportType.SALES):
            try:
                from app.services.data_quality import DataQualityService
                dq_service = DataQualityService()
                reconciliation_result = await dq_service.run_reconciliation(self.db, self.company_id, self.uploaded_by)
                logger.info(f"Ran post-import reconciliation for company {self.company_id}: run_id={reconciliation_result.get('id') if isinstance(reconciliation_result, dict) else 'ok'}")
            except Exception as e:
                logger.warning(f"Post-import reconciliation check failed: {e}")

        return {
            "import_id": str(history.id),
            "import_type": history.import_type.value,
            "filename": history.filename,
            "total_records": history.total_records,
            "successful_records": history.successful_records,
            "failed_records": history.failed_records,
            "skipped_records": history.skipped_records,
            "duplicate_records": history.duplicate_records,
            "status": history.status.value,
            "duration_seconds": history.duration_seconds,
            "reconciliation_run": reconciliation_result if isinstance(reconciliation_result, dict) else None,
            "errors": errors,
        }

    async def _get_or_create_category_id(self, category_name: str) -> UUID | None:
        if not category_name:
            return None
        from app.models.category import Category
        clean_target = self._clean_header(category_name)
        result = await self.db.execute(select(Category).where(Category.company_id == self.company_id))
        categories = result.scalars().all()
        for cat in categories:
            if self._clean_header(cat.name) == clean_target:
                return cat.id

        new_cat = Category(
            company_id=self.company_id,
            name=category_name.strip(),
            description="",
            status="ACTIVE",
        )
        self.db.add(new_cat)
        await self.db.flush()
        return new_cat.id

    async def _insert_or_update_product(self, normalized: dict[str, Any], action: str) -> None:
        sku = normalized["sku"].strip()
        category_name = normalized.get("category", "")
        category_id = await self._get_or_create_category_id(category_name) if category_name else None
        price = Decimal(str(normalized.get("unit_price", "0")))
        stock = int(normalized.get("stock_quantity", "0")) if normalized.get("stock_quantity") else 0

        if action == "UPDATE":
            result = await self.db.execute(select(Product).where(Product.company_id == self.company_id, Product.sku == sku))
            existing_prod = result.scalar_one_or_none()
            if existing_prod:
                existing_prod.name = normalized["product_name"].strip()
                if category_id:
                    existing_prod.category_id = category_id
                existing_prod.unit_price = price
                existing_prod.cost_price = price
                existing_prod.stock_quantity = stock
                self.db.add(existing_prod)
                await self.db.flush()
                return

        product = Product(
            company_id=self.company_id,
            name=normalized["product_name"].strip(),
            sku=sku,
            category_id=category_id,
            unit_price=price,
            cost_price=price,
            stock_quantity=stock,
            low_stock_threshold=5,
            lead_time_days=7,
            unit_of_measure="PCS",
            status="ACTIVE",
        )
        self.db.add(product)
        await self.db.flush()

    async def _insert_inventory_adjustment(self, normalized: dict[str, Any], action: str, product_sku_to_id: dict[str, UUID]) -> None:
        sku = normalized["sku"].strip()
        product_id = product_sku_to_id.get(sku)
        product = await self.db.get(Product, product_id)
        if not product:
            raise ValueError(f"Product SKU {sku} not found")

        adj_raw = normalized.get("adjustment_type", "").upper().replace(" ", "_")
        qty = int(normalized.get("quantity", "0"))
        reason = normalized.get("reason", "").strip() or "Imported inventory adjustment"
        remarks = normalized.get("remarks", "").strip() or None

        type_map = {
            "STOCK_IN": AdjustmentType.STOCK_IN,
            "IN": AdjustmentType.STOCK_IN,
            "ADD": AdjustmentType.STOCK_IN,
            "STOCK_OUT": AdjustmentType.STOCK_OUT,
            "OUT": AdjustmentType.STOCK_OUT,
            "REMOVE": AdjustmentType.STOCK_OUT,
            "MANUAL_ADJUSTMENT": AdjustmentType.MANUAL_ADJUSTMENT,
            "SET": AdjustmentType.MANUAL_ADJUSTMENT,
            "ADJUSTMENT": AdjustmentType.MANUAL_ADJUSTMENT,
        }
        adj_type = type_map.get(adj_raw, AdjustmentType.MANUAL_ADJUSTMENT)

        prev_qty = product.stock_quantity or 0
        if adj_type == AdjustmentType.STOCK_IN:
            new_qty = prev_qty + qty
            qty_changed = qty
            mov_type = MovementType.STOCK_ADDITION
        elif adj_type == AdjustmentType.STOCK_OUT:
            new_qty = max(0, prev_qty - qty)
            qty_changed = -qty
            mov_type = MovementType.STOCK_REMOVAL
        else:
            new_qty = qty
            qty_changed = new_qty - prev_qty
            mov_type = MovementType.MANUAL_ADJUSTMENT

        product.stock_quantity = new_qty
        self.db.add(product)

        adj = InventoryAdjustment(
            company_id=self.company_id,
            product_id=product.id,
            adjustment_type=adj_type,
            quantity=qty,
            reason=reason,
            remarks=remarks,
            adjusted_by=self.uploaded_by,
            adjusted_at=datetime.utcnow(),
        )
        self.db.add(adj)

        movement = StockMovement(
            company_id=self.company_id,
            product_id=product.id,
            movement_type=mov_type,
            previous_quantity=prev_qty,
            updated_quantity=new_qty,
            quantity_changed=qty_changed,
            reason=reason,
            user_id=self.uploaded_by,
            created_at=datetime.utcnow(),
        )
        self.db.add(movement)
        await self.db.flush()

    async def _insert_or_update_customer(self, normalized: dict[str, Any], action: str) -> None:
        email = normalized.get("email", "").strip() or None
        phone = normalized.get("phone", "").strip() or None
        name = normalized.get("name", "").strip()
        parts = name.split(" ", 1)
        first_name = parts[0] if parts else name
        last_name = parts[1] if len(parts) > 1 else ""
        cust_type = normalized.get("customer_type", "RETAIL").strip().upper() or "RETAIL"

        if action == "UPDATE":
            filters = []
            if email:
                filters.append(Customer.email == email)
            if phone:
                filters.append(Customer.phone == phone)
            if filters:
                result = await self.db.execute(select(Customer).where(Customer.company_id == self.company_id, or_(*filters)))
                existing_cust = result.scalar_one_or_none()
                if existing_cust:
                    existing_cust.first_name = first_name
                    existing_cust.last_name = last_name
                    if email:
                        existing_cust.email = email
                    if phone:
                        existing_cust.phone = phone
                    existing_cust.customer_type = cust_type
                    self.db.add(existing_cust)
                    await self.db.flush()
                    return

        customer = Customer(
            company_id=self.company_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            address="",
            city="",
            state="",
            country="",
            postal_code="",
            customer_type=cust_type,
            status="ACTIVE",
        )
        self.db.add(customer)
        await self.db.flush()

    async def _insert_sales_group(self, inv_num: str, items_group: list[tuple[int, dict[str, Any]]], customer_names: dict[str, UUID], product_names: dict[str, UUID]) -> None:
        first_norm = items_group[0][1]
        customer_name = first_norm["customer"]
        sale_date_raw = first_norm["sale_date"]
        customer_id = customer_names.get(customer_name)
        sale_date = datetime.strptime(sale_date_raw, "%Y-%m-%d")

        existing_db_invoices = await self._get_existing_invoices()
        invoice_number = inv_num
        if not invoice_number or invoice_number in existing_db_invoices or invoice_number.startswith("AUTO_GRP_"):
            year = datetime.utcnow().year
            prefix = f"IMP-{year}-"
            result = await self.db.execute(
                select(InvoiceSequence)
                .where(InvoiceSequence.company_id == self.company_id)
                .with_for_update()
            )
            sequence = result.scalar_one_or_none()
            if not sequence:
                sequence = InvoiceSequence(company_id=self.company_id, last_invoice_number=0)
                self.db.add(sequence)
                await self.db.flush()
            sequence.last_invoice_number += 1
            invoice_number = f"{prefix}{sequence.last_invoice_number:06d}"

        sale_items = []
        total_amount = Decimal("0")

        for original_idx, normalized in items_group:
            product_name = normalized["product"]
            product_id = product_names.get(product_name)
            quantity = int(normalized["quantity"])
            unit_price = Decimal(str(normalized["unit_price"]))
            discount = Decimal(str(normalized.get("discount", "0"))) if normalized.get("discount") else Decimal("0")
            tax = Decimal(str(normalized.get("tax", "0"))) if normalized.get("tax") else Decimal("0")

            item_total = (unit_price * quantity) - discount + tax
            total_amount += item_total

            sale_items.append(SaleItem(
                product_id=product_id,
                quantity=quantity,
                unit_price=float(unit_price),
                discount=float(discount),
                tax=float(tax),
                total=float(item_total),
            ))

            if product_id:
                product = await self.db.get(Product, product_id)
                if product:
                    product.stock_quantity = max((product.stock_quantity or 0) - quantity, 0)
                    self.db.add(product)

        sale = Sale(
            company_id=self.company_id,
            invoice_number=invoice_number,
            customer_id=customer_id,
            customer_name=customer_name,
            sale_date=sale_date,
            sales_channel=SalesChannel.RETAIL,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PAID,
            status=SaleStatus.COMPLETED,
            total_amount=float(total_amount),
            created_by=self.uploaded_by,
            items=sale_items,
        )
        self.db.add(sale)
        await self.db.flush()

    async def _create_import_notification(self, history: ImportHistory, status: ImportStatus) -> None:
        if status == ImportStatus.PROCESSING:
            notif_type = NotificationType.IMPORT_STARTED
            priority = NotificationPriority.LOW
            title = f"Import Started: {history.filename}"
            message = f"Processing started for {history.import_type.value} import '{history.filename}' ({history.total_records} records)."
        elif status == ImportStatus.COMPLETED:
            notif_type = NotificationType.IMPORT_COMPLETED
            priority = NotificationPriority.LOW
            title = f"Import Completed: {history.filename}"
            message = (
                f"Import of '{history.filename}' ({history.import_type.value}) completed successfully. "
                f"Total: {history.total_records}, Successful: {history.successful_records}."
            )
        elif status == ImportStatus.COMPLETED_WITH_ERRORS:
            notif_type = NotificationType.IMPORT_COMPLETED_WITH_ERRORS
            priority = NotificationPriority.MEDIUM
            title = f"Import Completed with Errors: {history.filename}"
            message = (
                f"Import of '{history.filename}' ({history.import_type.value}) completed with errors. "
                f"Total: {history.total_records}, Successful: {history.successful_records}, "
                f"Failed: {history.failed_records}, Duplicates: {history.duplicate_records}, Skipped: {history.skipped_records}."
            )
        elif status == ImportStatus.CANCELLED:
            notif_type = NotificationType.IMPORT_FAILED
            priority = NotificationPriority.MEDIUM
            title = f"Import Cancelled: {history.filename}"
            message = f"Import of '{history.filename}' was cancelled by the user. {history.successful_records} records were processed before cancellation."
        else:
            notif_type = NotificationType.IMPORT_FAILED
            priority = NotificationPriority.HIGH
            title = f"Import Failed: {history.filename}"
            message = (
                f"Import of '{history.filename}' ({history.import_type.value}) failed. "
                f"Total: {history.total_records}, Failed: {history.failed_records}."
            )

        await notification_service._create_alert_for_roles(
            self.db, self.company_id, notif_type, priority, title, message,
            NotificationResourceType.IMPORT, history.id, None,
        )

    @staticmethod
    def get_template_csv(import_type: ImportType) -> tuple[str, str]:
        if import_type == ImportType.PRODUCTS:
            content = (
                "Product Name,SKU,Category,Unit Price,Stock Quantity\n"
                "Wireless Noise-Canceling Headphones,WH-1000XM4,Electronics,299.99,50\n"
                "Ergonomic Mesh Office Chair,OC-CHAIR-01,Furniture,189.50,25\n"
                "Stainless Steel Water Bottle 1L,WB-STEEL-1L,Accessories,24.95,120\n"
                "Mechanical RGB Gaming Keyboard,KB-RGB-MECH,Electronics,89.00,40\n"
            )
            filename = "template_products.csv"
        elif import_type == ImportType.INVENTORY:
            content = (
                "SKU,Adjustment Type,Quantity,Reason,Remarks\n"
                "WH-1000XM4,STOCK_IN,20,Restock shipment,Supplier PO #4821\n"
                "OC-CHAIR-01,STOCK_OUT,2,Damaged in warehouse,Broken armrest during handling\n"
                "WB-STEEL-1L,MANUAL_ADJUSTMENT,100,Physical count reconciliation,Annual audit recount\n"
            )
            filename = "template_inventory.csv"
        elif import_type == ImportType.CUSTOMERS:
            content = (
                "Name,Email,Phone,Customer Type\n"
                "Alice Johnson,alice.j@example.com,+15551234567,RETAIL\n"
                "Robert Miller,robert.m@example.com,+15559876543,WHOLESALE\n"
                "Sarah Davis,sarah.d@example.com,+15554567890,VIP\n"
            )
            filename = "template_customers.csv"
        else:
            content = (
                "Customer,Product,Quantity,Unit Price,Sale Date,Invoice Number\n"
                "Alice Johnson,Wireless Noise-Canceling Headphones,1,299.99,2026-11-01,INV-2026-0001\n"
                "Robert Miller,Ergonomic Mesh Office Chair,2,189.50,2026-11-02,INV-2026-0002\n"
            )
            filename = "template_sales.csv"
        return content, filename

    @staticmethod
    def generate_error_csv(errors: list[ImportError] | list[dict]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Row Number", "Field", "Error Type", "Error Message", "Processing Status", "Record Data"])
        for err in errors:
            if isinstance(err, dict):
                writer.writerow([
                    err.get("row_number", ""),
                    err.get("field", "") or "-",
                    err.get("error_type", "VALIDATION_ERROR"),
                    err.get("error_message", ""),
                    err.get("processing_status", "FAILED"),
                    str(err.get("raw_data", "")).replace("\n", " "),
                ])
            else:
                writer.writerow([
                    err.row_number,
                    err.field or "-",
                    err.error_type or "VALIDATION_ERROR",
                    err.error_message,
                    err.processing_status or "FAILED",
                    str(err.raw_data or "").replace("\n", " "),
                ])
        return output.getvalue()
