from fastapi import Request
from fastapi.responses import JSONResponse
import logging
from sqlalchemy.exc import SQLAlchemyError
from fastapi.exceptions import RequestValidationError, HTTPException as FastAPIHTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("retailpulse")

def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin")
    if origin:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*",
        }
    return {}

class RetailPulseException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail

async def retailpulse_exception_handler(request: Request, exc: RetailPulseException):
    logger.error(f"RetailPulseException: {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail}, headers=_cors_headers(request))

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(status_code=422, content={"error": "Validation failed", "details": exc.errors()}, headers=_cors_headers(request))

async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Database error occurred"}, headers=_cors_headers(request))

async def value_error_handler(request: Request, exc: ValueError):
    logger.warning(f"Value error: {exc}")
    return JSONResponse(status_code=400, content={"error": "Invalid request"}, headers=_cors_headers(request))

async def generic_exception_handler(request: Request, exc: Exception):
    cors = _cors_headers(request)
    if isinstance(exc, StarletteHTTPException):
        custom_headers = getattr(exc, "headers", None) or {}
        combined = {**cors, **custom_headers}
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=combined if combined else None
        )
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    import traceback
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": traceback.format_exc()},
        headers=cors if cors else None
    )
