import os
import sys
import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

from app.config import settings
settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

from app.database import Base
from app.models.company import Company
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.product import Product, ProductStatus
from app.models.sale import Sale, SaleItem, SaleStatus, PaymentStatus
from app.models.transaction import Transaction
from app.models.customer import Customer, CustomerStatus, CustomerSegment
from app.models.customer_timeline import CustomerTimeline
from app.models.inventory import StockMovement, InventoryAdjustment, MovementType
from app.models.notification import Notification, NotificationType
from app.models.forecast import DemandForecast, ForecastHistory, ForecastPeriodType

engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    echo=False,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session = TestingSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
