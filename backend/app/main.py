from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from app.config import settings
from app.routers import api_router
from app.middleware.error_handler import (
    retailpulse_exception_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    value_error_handler,
    generic_exception_handler,
    RetailPulseException,
)
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from app.services.scheduler import scheduler

def create_app() -> FastAPI:
    application = FastAPI(title=settings.APP_NAME, version="1.0.0")

    application.add_exception_handler(RetailPulseException, retailpulse_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    application.add_exception_handler(ValueError, value_error_handler)
    application.add_exception_handler(Exception, generic_exception_handler)

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
        import subprocess
        alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
        subprocess.run(["alembic", "-c", str(alembic_ini), "upgrade", "head"], check=True)
        scheduler.start()

    @application.on_event("shutdown")
    async def on_shutdown():
        scheduler.shutdown()

    return application

app = create_app()

