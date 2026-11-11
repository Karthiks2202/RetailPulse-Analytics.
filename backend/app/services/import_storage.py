import os
import re
import csv
import io
from pathlib import Path
from typing import Generator, Tuple, List, Dict, Any, Optional
from uuid import UUID
from fastapi import UploadFile

# Directory for storing uploaded CSV files persistently
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "uploads" / "imports"
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# Known dangerous/binary signatures
BINARY_SIGNATURES = [
    (b"\x4d\x5a", "Windows Executable (MZ/PE)"),
    (b"\x7fELF", "Linux Executable (ELF)"),
    (b"PK\x03\x04", "ZIP / Office Spreadsheet (PK) - Please export as CSV text"),
    (b"%PDF", "PDF Document"),
    (b"\xca\xfe\xba\xbe", "Java Class File / Mach-O"),
    (b"\xfe\xed\xfa\xce", "Mach-O Binary"),
]


def ensure_storage_dir() -> Path:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return STORAGE_DIR


def get_import_file_path(import_id: UUID) -> Path:
    ensure_storage_dir()
    return STORAGE_DIR / f"{import_id}.csv"


def import_file_exists(import_id: UUID) -> bool:
    path = get_import_file_path(import_id)
    return path.is_file() and path.stat().st_size > 0


def delete_import_file(import_id: UUID) -> bool:
    path = get_import_file_path(import_id)
    if path.is_file():
        try:
            path.unlink()
            return True
        except OSError:
            return False
    return False


def validate_content_security(sample: bytes) -> None:
    """
    Validates actual file content:
    - Rejects binary executables, zip/docx/xlsx, PDF.
    - Rejects files containing null bytes (\x00).
    - Ensures sample can be decoded as text.
    """
    if not sample:
        raise ValueError("Uploaded file is empty.")

    # Check for known binary magic bytes
    for sig, desc in BINARY_SIGNATURES:
        if sample.startswith(sig):
            raise ValueError(f"Invalid file format: Detected {desc}. Only plain text CSV files are allowed.")

    # Null byte check (typical of binary files)
    if b"\x00" in sample:
        raise ValueError("Invalid file content: Binary data or NULL bytes detected in CSV file.")

    # Test decoding
    decoded = False
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            sample.decode(enc)
            decoded = True
            break
        except UnicodeDecodeError:
            continue

    if not decoded:
        raise ValueError("Invalid file encoding: File cannot be decoded as valid text (UTF-8 or Latin-1 required).")


async def save_uploaded_file(
    import_id: UUID,
    file: UploadFile,
    max_size_bytes: int = MAX_FILE_SIZE_BYTES,
) -> tuple[Path, int]:
    """
    Streamingly saves an uploaded file to persistent disk storage, enforcing
    file size limits and verifying content security on the first chunk.
    """
    ensure_storage_dir()
    target_path = get_import_file_path(import_id)

    total_bytes = 0
    first_chunk = True

    try:
        with open(target_path, "wb") as out_file:
            while True:
                chunk = await file.read(64 * 1024)  # 64 KB chunks
                if not chunk:
                    break

                if first_chunk:
                    validate_content_security(chunk[:4096])
                    first_chunk = False

                total_bytes += len(chunk)
                if total_bytes > max_size_bytes:
                    raise ValueError(f"File size exceeds the {max_size_bytes // (1024 * 1024)}MB limit")

                out_file.write(chunk)

        if total_bytes == 0:
            if target_path.exists():
                target_path.unlink()
            raise ValueError("Uploaded file is empty.")

        return target_path, total_bytes
    except Exception:
        if target_path.exists():
            try:
                target_path.unlink()
            except OSError:
                pass
        raise


def save_file_content(
    import_id: UUID,
    content: bytes,
    max_size_bytes: int = MAX_FILE_SIZE_BYTES,
) -> Path:
    """
    Saves in-memory bytes to persistent disk storage with size and security checks.
    """
    if len(content) > max_size_bytes:
        raise ValueError(f"File size exceeds the {max_size_bytes // (1024 * 1024)}MB limit")

    if not content:
        raise ValueError("File content is empty.")

    validate_content_security(content[:4096])

    ensure_storage_dir()
    target_path = get_import_file_path(import_id)
    with open(target_path, "wb") as out_file:
        out_file.write(content)

    return target_path


def detect_csv_dialect_from_line(line: str) -> str:
    """
    Detects delimiter: comma, semicolon, or tab.
    """
    candidates = [",", ";", "\t"]
    counts = {delim: line.count(delim) for delim in candidates}
    best_delim = max(counts, key=counts.get)
    return best_delim if counts[best_delim] > 0 else ","


def inspect_csv_file(file_path: Path) -> tuple[list[str], list[dict[str, str]], int]:
    """
    Opens CSV file from disk, detects headers, previews up to 10 rows,
    and returns (columns, preview_rows, total_records) without loading all into memory.
    """
    if not file_path.exists():
        raise ValueError(f"Import file not found: {file_path}")

    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        first_line = f.readline()
        if not first_line:
            raise ValueError("The CSV file is empty.")

        delimiter = detect_csv_dialect_from_line(first_line)
        f.seek(0)

        reader = csv.reader(f, delimiter=delimiter)
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise ValueError("The CSV file is empty or missing headers.")

        headers = [h.strip().lstrip("\ufeff") for h in raw_headers if h is not None]
        if not any(headers):
            raise ValueError("No valid column headers found in CSV file.")

        preview_rows: list[dict[str, str]] = []
        total_rows = 0

        for row in reader:
            if not row or not any(field.strip() for field in row):
                continue
            total_rows += 1
            if len(preview_rows) < 10:
                row_dict = {}
                for i, h in enumerate(headers):
                    val = row[i].strip() if i < len(row) else ""
                    row_dict[h] = val
                preview_rows.append(row_dict)

    return headers, preview_rows, total_rows


def stream_csv_rows(
    file_path: Path,
) -> Generator[Tuple[int, list[str], dict[str, str]], None, None]:
    """
    Streams rows from a CSV file lazily:
    Yields: (row_number, headers, row_dict)
    row_number starts at 2 (accounting for header row at 1).
    """
    if not file_path.exists():
        raise ValueError(f"Import file not found: {file_path}")

    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        first_line = f.readline()
        if not first_line:
            return

        delimiter = detect_csv_dialect_from_line(first_line)
        f.seek(0)

        reader = csv.reader(f, delimiter=delimiter)
        try:
            raw_headers = next(reader)
        except StopIteration:
            return

        headers = [h.strip().lstrip("\ufeff") for h in raw_headers if h is not None]

        row_number = 1
        for row in reader:
            row_number += 1
            # Skip empty lines
            if not row or not any(field.strip() for field in row):
                continue

            row_dict = {}
            for i, h in enumerate(headers):
                val = row[i].strip() if i < len(row) else ""
                row_dict[h] = val

            yield row_number, headers, row_dict

