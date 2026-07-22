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
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import engine
from app.models import company, user, refresh_token, audit_log, category, product, transaction, sale
import random

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

        from sqlalchemy.ext.asyncio import async_sessionmaker
        from app.models.product import Product, ProductStatus, UnitOfMeasure
        from app.models.category import Category, CategoryStatus
        from app.models.transaction import Transaction, TransactionType, TransactionChannel
        from datetime import datetime, timedelta
        from decimal import Decimal

        async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with async_session() as session:
            from sqlalchemy import select
            company_result = await session.execute(select(company.Company).limit(1))
            first_company = company_result.scalar_one_or_none()

            if first_company:
                category_result = await session.execute(select(Category).where(Category.company_id == first_company.id))
                electronics = category_result.scalar_one_or_none()
                if not electronics:
                    electronics = Category(
                        company_id=first_company.id,
                        name="Electronics",
                        description="Electronic devices and accessories",
                        status=CategoryStatus.ACTIVE,
                    )
                    session.add(electronics)
                    await session.commit()
                    await session.refresh(electronics)

                product_result = await session.execute(select(Product).where(Product.company_id == first_company.id))
                existing_products = product_result.scalars().all()

                if not existing_products:
                    products = [
                        Product(company_id=first_company.id, category_id=electronics.id, name="Wireless Headphones", sku="RTL-10001", brand="Acme", unit_price=Decimal("79.99"), cost_price=Decimal("45.00"), stock_quantity=120, unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE),
                        Product(company_id=first_company.id, category_id=electronics.id, name="USB-C Charging Cable", sku="RTL-10002", brand="Acme", unit_price=Decimal("19.99"), cost_price=Decimal("8.50"), stock_quantity=400, unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE),
                        Product(company_id=first_company.id, category_id=electronics.id, name="Smart Watch Gen2", sku="RTL-10003", brand="Nova", unit_price=Decimal("199.00"), cost_price=Decimal("120.00"), stock_quantity=60, unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE),
                        Product(company_id=first_company.id, category_id=electronics.id, name="Bluetooth Speaker", sku="RTL-10004", brand="Nova", unit_price=Decimal("49.50"), cost_price=Decimal("25.00"), stock_quantity=90, unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.INACTIVE),
                        Product(company_id=first_company.id, category_id=electronics.id, name="Laptop Stand", sku="RTL-10005", brand="Acme", unit_price=Decimal("39.95"), cost_price=Decimal("18.00"), stock_quantity=150, unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE),
                    ]
                    session.add_all(products)
                    await session.commit()

                tx_result = await session.execute(select(Transaction).where(Transaction.company_id == first_company.id))
                existing_txs = tx_result.scalars().all()

                if not existing_txs:
                    now = datetime.utcnow()
                    txs = []
                    for i in range(6):
                        month_start = (now - timedelta(days=30 * (5 - i))).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                        for _ in range(8):
                            channel = random.choice(list(TransactionChannel))
                            amount = Decimal(str(round(random.uniform(20, 250), 2)))
                            txs.append(Transaction(
                                company_id=first_company.id,
                                amount=amount,
                                type=TransactionType.SALE,
                                channel=channel,
                                created_at=month_start + timedelta(days=random.randint(0, 27), hours=random.randint(0, 23)),
                            ))
                    session.add_all(txs)
                    await session.commit()

    return application

app = create_app()

