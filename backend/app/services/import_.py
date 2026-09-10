import csv
import io
import re
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.import_history import ImportHistory, ImportStatus, ImportType
from app.models.product import Product
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.crud.import_history import import_history as import_history_crud

logger = logging.getLogger("retailpulse")


class ImportValidationError(Exception):
    def __init__(self, row_number: int, field: str | None, message: str, raw_data: str | None = None):
        self.row_number = row_number
        self.field = field
        self.message = message
        self.raw_data = raw_data
        super().__init__(message)


class DuplicateRecordError(Exception):
    def __init__(self, row_number: int, field: str | None, message: str, raw_data: str | None = None):
        self.row_number = row_number
        self.field = field
        self.message = message
        self.raw_data = raw_data
        super().__init__(message)


class ImportService:
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
        ImportType.CUSTOMERS: {
            "required_columns": ["Name", "Email", "Phone"],
            "column_map": {
                "Name": "name",
                "Email": "email",
                "Phone": "phone",
            },
            "aliases": {
                "name": ["name", "customer name", "customer_name", "full name", "client name", "client", "contact name", "customer", "first name"],
                "email": ["email", "email address", "email_address", "mail", "e mail"],
                "phone": ["phone", "phone number", "phone_number", "mobile", "contact", "tel", "telephone", "cell"],
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

    async def create_import_history(self, import_type: ImportType, filename: str, total_records: int, commit: bool = True) -> ImportHistory:
        return await import_history_crud.create(self.db, self.company_id, import_type, filename, self.uploaded_by, total_records, commit=commit)

    async def get_import_history(self, import_id: UUID) -> ImportHistory | None:
        return await import_history_crud.get(self.db, import_id, self.company_id)

    async def list_import_history(self, skip: int = 0, limit: int = 100, import_type: ImportType | None = None, status: ImportStatus | None = None) -> tuple[list[ImportHistory], int]:
        return await import_history_crud.list(self.db, self.company_id, skip=skip, limit=limit, import_type=import_type, status=status)

    async def get_import_errors(self, import_id: UUID) -> list[dict]:
        errors = await import_history_crud.get_errors(self.db, import_id, self.company_id)
        return [
            {
                "id": str(e.id),
                "row_number": e.row_number,
                "field": e.field,
                "error_message": e.error_message,
                "raw_data": e.raw_data,
            }
            for e in errors
        ]

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

    def validate_row(self, import_type: ImportType, row_number: int, normalized_row: dict[str, Any], existing_skus: set[str], existing_emails: set[str], existing_phones: set[str], existing_invoices: set[str], customer_names: dict[str, UUID], product_names: dict[str, UUID], available_stock: dict[UUID, int]) -> None:
        if import_type == ImportType.PRODUCTS:
            sku = normalized_row.get("sku", "")
            product_name = normalized_row.get("product_name", "")
            if not sku:
                raise ImportValidationError(row_number, "sku", "SKU is required", str(normalized_row))
            if not product_name:
                raise ImportValidationError(row_number, "product_name", "Product Name is required", str(normalized_row))
            if sku in existing_skus:
                raise DuplicateRecordError(row_number, "sku", f"Duplicate SKU: {sku}", str(normalized_row))
            existing_skus.add(sku)
            try:
                price = Decimal(str(normalized_row.get("unit_price", "0")))
            except InvalidOperation:
                raise ImportValidationError(row_number, "unit_price", "Invalid Unit Price", str(normalized_row))
            if price <= 0:
                raise ImportValidationError(row_number, "unit_price", "Unit Price must be greater than zero", str(normalized_row))
            try:
                stock = int(normalized_row.get("stock_quantity", "0"))
            except ValueError:
                raise ImportValidationError(row_number, "stock_quantity", "Invalid Stock Quantity", str(normalized_row))
            if stock < 0:
                raise ImportValidationError(row_number, "stock_quantity", "Stock Quantity cannot be negative", str(normalized_row))

        elif import_type == ImportType.CUSTOMERS:
            name = normalized_row.get("name", "")
            email = normalized_row.get("email", "")
            phone = normalized_row.get("phone", "")
            if not name:
                raise ImportValidationError(row_number, "name", "Name is required", str(normalized_row))
            if not email:
                raise ImportValidationError(row_number, "email", "Email is required", str(normalized_row))
            if email in existing_emails:
                raise DuplicateRecordError(row_number, "email", f"Duplicate email: {email}", str(normalized_row))
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
                raise ImportValidationError(row_number, "email", f"Invalid email: {email}", str(normalized_row))
            existing_emails.add(email)
            if not phone:
                raise ImportValidationError(row_number, "phone", "Phone is required", str(normalized_row))
            if phone in existing_phones:
                raise DuplicateRecordError(row_number, "phone", f"Duplicate phone: {phone}", str(normalized_row))
            if not re.match(r"^\+?[\d\s()-]{7,}$", phone):
                raise ImportValidationError(row_number, "phone", f"Invalid phone: {phone}", str(normalized_row))
            existing_phones.add(phone)

        elif import_type == ImportType.SALES:
            customer_name = normalized_row.get("customer", "")
            product_name = normalized_row.get("product", "")
            quantity_raw = normalized_row.get("quantity", "")
            unit_price_raw = normalized_row.get("unit_price", "")
            sale_date_raw = normalized_row.get("sale_date", "")
            invoice_number = normalized_row.get("invoice_number", "")

            if not customer_name:
                raise ImportValidationError(row_number, "customer", "Customer is required", str(normalized_row))
            if not product_name:
                raise ImportValidationError(row_number, "product", "Product is required", str(normalized_row))
            if not invoice_number:
                raise ImportValidationError(row_number, "invoice_number", "Invoice Number is required", str(normalized_row))
            if invoice_number in existing_invoices:
                raise DuplicateRecordError(row_number, "invoice_number", f"Duplicate invoice number: {invoice_number}", str(normalized_row))
            existing_invoices.add(invoice_number)

            try:
                quantity = int(quantity_raw)
            except (TypeError, ValueError):
                raise ImportValidationError(row_number, "quantity", "Invalid Quantity", str(normalized_row))
            if quantity <= 0:
                raise ImportValidationError(row_number, "quantity", "Quantity must be greater than zero", str(normalized_row))

            try:
                unit_price = Decimal(str(unit_price_raw))
            except InvalidOperation:
                raise ImportValidationError(row_number, "unit_price", "Invalid Unit Price", str(normalized_row))
            if unit_price < 0:
                raise ImportValidationError(row_number, "unit_price", "Unit Price cannot be negative", str(normalized_row))

            try:
                datetime.strptime(sale_date_raw, "%Y-%m-%d")
            except Exception:
                raise ImportValidationError(row_number, "sale_date", "Invalid Sale Date, expected YYYY-MM-DD", str(normalized_row))

            customer_id = customer_names.get(customer_name)
            if not customer_id:
                raise ImportValidationError(row_number, "customer", f"Customer not found: {customer_name}", str(normalized_row))

            product_id = product_names.get(product_name)
            if not product_id:
                raise ImportValidationError(row_number, "product", f"Product not found: {product_name}", str(normalized_row))

            available = available_stock.get(product_id, 0)
            if quantity > available:
                raise ImportValidationError(row_number, "quantity", f"Quantity exceeds available stock. Available: {available}, Requested: {quantity}", str(normalized_row))
            available_stock[product_id] -= quantity

    async def _get_existing_skus(self) -> set[str]:
        result = await self.db.execute(select(Product.sku).where(Product.company_id == self.company_id))
        return {row.sku for row in result.all()}

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
        return {row.invoice_number for row in result.all()}

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
        return {row.name: row.id for row in result.all()}

    async def _get_available_stock(self) -> dict[UUID, int]:
        result = await self.db.execute(select(Product.id, Product.stock_quantity, Product.reserved_stock).where(Product.company_id == self.company_id))
        stock: dict[UUID, int] = {}
        for row in result.all():
            stock[row.id] = max((row.stock_quantity or 0) - (row.reserved_stock or 0), 0)
        return stock

    async def validate_import(self, import_type: ImportType, file_content: bytes, filename: str, import_id: UUID | None = None) -> dict:
        columns, rows = self.parse_csv(file_content)
        errors: list[dict[str, Any]] = []

        try:
            self.validate_columns(import_type, columns)
        except ValueError as e:
            errors.append({
                "row_number": 1,
                "field": "Header",
                "error_message": str(e),
                "raw_data": f"Columns found: {', '.join(columns)}" if columns else "Empty file or no columns found",
            })
            return {
                "import_id": str(import_id) if import_id else "00000000-0000-0000-0000-000000000000",
                "import_type": import_type.value,
                "filename": filename,
                "total_records": len(rows),
                "columns": columns,
                "preview_rows": [],
                "valid_records": 0,
                "invalid_records": len(rows) or 1,
                "duplicate_records": 0,
                "errors": errors,
                "status": "FAILED",
            }

        valid_rows = 0
        duplicate_rows = 0
        invalid_rows = 0

        existing_skus = await self._get_existing_skus() if import_type == ImportType.PRODUCTS else set()
        existing_emails, existing_phones = await self._get_existing_customer_unique_values() if import_type == ImportType.CUSTOMERS else (set(), set())
        customer_names = await self._get_customer_names() if import_type == ImportType.SALES else {}
        product_names = await self._get_product_names() if import_type == ImportType.SALES else {}
        available_stock = await self._get_available_stock() if import_type == ImportType.SALES else {}
        existing_invoices = await self._get_existing_invoices() if import_type == ImportType.SALES else set()

        preview_rows = []
        for idx, row in enumerate(rows, start=2):
            normalized = self.normalize_row(import_type, row)
            try:
                self.validate_row(import_type, idx, normalized, existing_skus, existing_emails, existing_phones, existing_invoices, customer_names, product_names, available_stock)
                valid_rows += 1
            except DuplicateRecordError as e:
                duplicate_rows += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_message": e.message,
                    "raw_data": e.raw_data or normalized,
                })
            except ImportValidationError as e:
                invalid_rows += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_message": e.message,
                    "raw_data": e.raw_data or normalized,
                })
            if idx <= 10:
                preview_rows.append(normalized)

        return {
            "import_id": str(import_id) if import_id else "00000000-0000-0000-0000-000000000000",
            "import_type": import_type.value,
            "filename": filename,
            "total_records": len(rows),
            "columns": columns,
            "preview_rows": preview_rows,
            "valid_records": valid_rows,
            "invalid_records": invalid_rows,
            "duplicate_records": duplicate_rows,
            "errors": errors,
            "status": "PENDING",
        }

    async def process_import(self, import_type: ImportType, file_content: bytes, filename: str, import_id: UUID | None = None) -> dict:
        columns, rows = self.parse_csv(file_content)
        self.validate_columns(import_type, columns)

        history = None
        if import_id:
            history = await self.get_import_history(import_id)
            if not history:
                raise ValueError(f"Import history not found: {import_id}")
            await import_history_crud.update_status(self.db, history, ImportStatus.PROCESSING, commit=False)
        else:
            history = await self.create_import_history(import_type, filename, len(rows), commit=False)
            await import_history_crud.update_status(self.db, history, ImportStatus.PROCESSING, commit=False)

        existing_skus = await self._get_existing_skus() if import_type == ImportType.PRODUCTS else set()
        existing_emails, existing_phones = await self._get_existing_customer_unique_values() if import_type == ImportType.CUSTOMERS else (set(), set())
        customer_names = await self._get_customer_names() if import_type == ImportType.SALES else {}
        product_names = await self._get_product_names() if import_type == ImportType.SALES else {}
        available_stock = await self._get_available_stock() if import_type == ImportType.SALES else {}
        existing_invoices = await self._get_existing_invoices() if import_type == ImportType.SALES else set()

        valid_rows: list[tuple[int, dict[str, Any]]] = []
        errors: list[dict[str, Any]] = []
        duplicates = 0
        invalid_rows = 0

        for idx, row in enumerate(rows, start=2):
            normalized = self.normalize_row(import_type, row)
            try:
                self.validate_row(import_type, idx, normalized, existing_skus, existing_emails, existing_phones, existing_invoices, customer_names, product_names, available_stock)
                valid_rows.append((idx, normalized))
            except DuplicateRecordError as e:
                duplicates += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_message": e.message,
                    "raw_data": e.raw_data or str(normalized),
                })
            except ImportValidationError as e:
                invalid_rows += 1
                errors.append({
                    "row_number": e.row_number,
                    "field": e.field,
                    "error_message": e.message,
                    "raw_data": e.raw_data or str(normalized),
                 })

        successful = 0
        failed = 0
        batch_size = 50

        for batch_start in range(0, len(valid_rows), batch_size):
            batch = valid_rows[batch_start:batch_start + batch_size]
            try:
                for original_idx, normalized in batch:
                    if import_type == ImportType.PRODUCTS:
                        await self._insert_product(normalized)
                    elif import_type == ImportType.CUSTOMERS:
                        await self._insert_customer(normalized)
                    elif import_type == ImportType.SALES:
                        await self._insert_sale(normalized, customer_names, product_names)
                await self.db.commit()
                successful += len(batch)
            except Exception as e:
                await self.db.rollback()
                failed += len(batch)
                logger.exception("Batch insert failed during import")
                for original_idx, normalized in batch:
                    errors.append({
                        "row_number": original_idx,
                        "field": None,
                        "error_message": "Unable to process this record. Please check the data and try again.",
                        "raw_data": str(normalized),
                    })

            await import_history_crud.update_status(
                self.db, history, ImportStatus.PROCESSING,
                successful, failed, duplicates, commit=True
            )

        for error in errors:
            await import_history_crud.add_error(self.db, history.id, error["row_number"], error["error_message"], error.get("field"), error.get("raw_data"), commit=False)

        status = ImportStatus.COMPLETED if failed == 0 and duplicates == 0 and invalid_rows == 0 else ImportStatus.COMPLETED_WITH_ERRORS
        if failed > 0 and successful == 0 and duplicates == 0 and invalid_rows == 0:
            status = ImportStatus.FAILED

        await import_history_crud.update_status(self.db, history, status, successful, failed, duplicates, commit=True)
        await self.db.refresh(history)

        return {
            "import_id": str(history.id),
            "import_type": import_type.value,
            "filename": filename,
            "total_records": len(rows),
            "successful_records": successful,
            "failed_records": failed,
            "duplicate_records": duplicates,
            "status": history.status.value,
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

    async def _insert_product(self, normalized: dict[str, Any]) -> None:
        from app.crud.product import product as product_crud
        sku = normalized["sku"]
        category_name = normalized.get("category", "")
        category_id = await self._get_or_create_category_id(category_name) if category_name else None
        product = Product(
            company_id=self.company_id,
            name=normalized["product_name"],
            sku=sku,
            category_id=category_id,
            unit_price=Decimal(str(normalized.get("unit_price", "0"))),
            cost_price=Decimal(str(normalized.get("unit_price", "0"))),
            stock_quantity=int(normalized.get("stock_quantity", "0")) if normalized.get("stock_quantity") else 0,
            low_stock_threshold=5,
            lead_time_days=7,
            unit_of_measure="PCS",
            status="ACTIVE",
        )
        self.db.add(product)
        await self.db.flush()

    async def _insert_customer(self, normalized: dict[str, Any]) -> None:
        from app.crud.customer import customer as customer_crud
        name = normalized.get("name", "")
        parts = name.split(" ", 1)
        first_name = parts[0] if parts else name
        last_name = parts[1] if len(parts) > 1 else ""
        customer = Customer(
            company_id=self.company_id,
            first_name=first_name,
            last_name=last_name,
            email=normalized.get("email") or None,
            phone=normalized.get("phone") or None,
            address="",
            city="",
            state="",
            country="",
            postal_code="",
            customer_type="RETAIL",
            status="ACTIVE",
        )
        self.db.add(customer)
        await self.db.flush()

    async def _insert_sale(self, normalized: dict[str, Any], customer_names: dict[str, UUID], product_names: dict[str, UUID]) -> None:
        from app.models.sale import SalesChannel, PaymentMethod, SaleStatus, PaymentStatus, SaleItem, InvoiceSequence
        from app.models.product import Product
        from decimal import Decimal
        customer_name = normalized["customer"]
        product_name = normalized["product"]
        quantity = int(normalized["quantity"])
        unit_price = Decimal(str(normalized["unit_price"]))
        sale_date_raw = normalized["sale_date"]

        customer_id = customer_names.get(customer_name)
        product_id = product_names.get(product_name)
        if not customer_id or not product_id:
            raise ImportValidationError(0, None, "Invalid customer or product", str(normalized))

        sale_date = datetime.strptime(sale_date_raw, "%Y-%m-%d")

        invoice_number = normalized.get("invoice_number")
        if not invoice_number:
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
            total_amount=float(unit_price) * quantity,
        )
        sale.items.append(SaleItem(
            product_id=product_id,
            quantity=quantity,
            unit_price=float(unit_price),
            discount=0.0,
            tax=0.0,
            total=float(unit_price) * quantity,
        ))
        self.db.add(sale)
        await self.db.flush()

        product = await self.db.get(Product, product_id)
        if product:
            product.stock_quantity = max((product.stock_quantity or 0) - quantity, 0)
            self.db.add(product)
