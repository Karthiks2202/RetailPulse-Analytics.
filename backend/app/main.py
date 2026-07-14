from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import api_router
from app.middleware.error_handler import (
    retailpulse_exception_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    generic_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from app.database import engine
from app.models import company, user, refresh_token, audit_log

def create_app() -> FastAPI:
    application = FastAPI(title=settings.APP_NAME, version="1.0.0")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.add_exception_handler(Exception, generic_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    from app.middleware.error_handler import RetailPulseException
    application.add_exception_handler(RetailPulseException, retailpulse_exception_handler)

    application.include_router(api_router)

    @application.get("/health")
    async def health():
        return {"status": "ok"}

    @application.on_event("startup")
    async def on_startup():
        from app.database import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    return application

app = create_app()
