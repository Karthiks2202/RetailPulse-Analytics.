from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger("retailpulse")

class RetailPulseException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail

async def retailpulse_exception_handler(request: Request, exc: RetailPulseException):
    logger.error(f"RetailPulseException: {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(status_code=422, content={"error": "Validation failed", "details": exc.errors()})

async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error: {exc}")
    return JSONResponse(status_code=500, content={"error": "Database error occurred"})

async def value_error_handler(request: Request, exc: ValueError):
    logger.warning(f"Value error: {exc}")
    return JSONResponse(status_code=400, content={"error": str(exc)})

async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})
