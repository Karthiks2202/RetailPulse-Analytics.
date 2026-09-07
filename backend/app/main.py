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
import asyncio
import subprocess
from contextlib import asynccontextmanager

from app.services.scheduler import scheduler

def run_migrations():
    alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    try:
        subprocess.run(["alembic", "-c", str(alembic_ini), "upgrade", "head"], check=True, capture_output=True)
    except Exception:
        pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(run_migrations)
    if not scheduler.running:
        scheduler.start()
    try:
        yield
    finally:
        if scheduler.running:
            try:
                scheduler.shutdown(wait=False)
            except Exception:
                pass

def create_app() -> FastAPI:
    application = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)

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

    return application

app = create_app()

