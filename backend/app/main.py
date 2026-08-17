from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import api_router
from app.middleware.error_handler import (
    retailpulse_exception_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    value_error_handler,
    generic_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from app.database import engine

def create_app() -> FastAPI:
    application = FastAPI(title=settings.APP_NAME, version="1.0.0")

    # Exception handlers must be registered BEFORE middleware so CORS middleware
    # (added last) can wrap all responses — including error responses — with
    # the correct CORS headers. This prevents OPTIONS preflight 400 errors.
    from app.middleware.error_handler import RetailPulseException
    application.add_exception_handler(RetailPulseException, retailpulse_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    application.add_exception_handler(ValueError, value_error_handler)
    application.add_exception_handler(Exception, generic_exception_handler)

    # CORS middleware is added LAST so it is the outermost layer — it processes
    # every request (including OPTIONS preflight) before any handler.
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    application.include_router(api_router)

    @application.get("/health")
    async def health():
        return {"status": "ok"}

    @application.on_event("startup")
    async def on_startup():
        from app.database import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("CREATE SEQUENCE IF NOT EXISTS invoice_seq"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id)"))
            await conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth TIMESTAMP NULL"))
            await conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR NULL DEFAULT 'RETAIL'"))
            await conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_sales_channel VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR NULL"))
            await conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE"))
            await conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT NULL"))
            await conn.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status VARCHAR NULL DEFAULT 'PAID'"))
            await conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS segment VARCHAR NULL DEFAULT 'NEW'"))

    return application

app = create_app()

