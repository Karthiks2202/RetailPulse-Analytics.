"""
seed_data.py — Development seed script for RetailPulse Analytics.

Usage:
    python seed_data.py

Run this ONCE after initial setup to populate the database with sample categories,
products, and transaction data for development/testing purposes.

This script is intentionally NOT called from app startup. It is safe to re-run —
all inserts are idempotent (checks for existing data before inserting).

DO NOT run this in production.
"""
import asyncio
import random
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy import select
from app.database import engine, Base
from app.models.product import Product, ProductStatus, UnitOfMeasure
from app.models.category import Category, CategoryStatus
from app.models.transaction import Transaction, TransactionType, TransactionChannel
from app.models.company import Company
from sqlalchemy import text


async def seed_data():
    # Ensure tables exist before seeding
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("CREATE SEQUENCE IF NOT EXISTS invoice_seq"))

    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        company_result = await session.execute(select(Company).limit(1))
        first_company = company_result.scalar_one_or_none()

        if not first_company:
            print("No company found in database. Register a company via the API first, then re-run this script.")
            return

        print(f"Seeding data for company: {first_company.name} ({first_company.id})")

        # --- Categories ---
        category_result = await session.execute(
            select(Category).where(
                Category.company_id == first_company.id,
                Category.name == "Electronics"
            )
        )
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
            print("  Seeded category: Electronics")
        else:
            print("  Category 'Electronics' already exists — skipping.")

        # --- Products ---
        product_result = await session.execute(
            select(Product).where(Product.company_id == first_company.id)
        )
        existing_products = product_result.scalars().all()

        if not existing_products:
            seed_products = [
                Product(
                    company_id=first_company.id, category_id=electronics.id,
                    name="Wireless Headphones", sku="RTL-10001", brand="Acme",
                    unit_price=Decimal("79.99"), cost_price=Decimal("45.00"),
                    stock_quantity=120, low_stock_threshold=10,
                    unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE,
                ),
                Product(
                    company_id=first_company.id, category_id=electronics.id,
                    name="USB-C Charging Cable", sku="RTL-10002", brand="Acme",
                    unit_price=Decimal("19.99"), cost_price=Decimal("8.50"),
                    stock_quantity=400, low_stock_threshold=20,
                    unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE,
                ),
                Product(
                    company_id=first_company.id, category_id=electronics.id,
                    name="Smart Watch Gen2", sku="RTL-10003", brand="Nova",
                    unit_price=Decimal("199.00"), cost_price=Decimal("120.00"),
                    stock_quantity=60, low_stock_threshold=5,
                    unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE,
                ),
                Product(
                    company_id=first_company.id, category_id=electronics.id,
                    name="Bluetooth Speaker", sku="RTL-10004", brand="Nova",
                    unit_price=Decimal("49.50"), cost_price=Decimal("25.00"),
                    stock_quantity=90, low_stock_threshold=10,
                    unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.INACTIVE,
                ),
                Product(
                    company_id=first_company.id, category_id=electronics.id,
                    name="Laptop Stand", sku="RTL-10005", brand="Acme",
                    unit_price=Decimal("39.95"), cost_price=Decimal("18.00"),
                    stock_quantity=150, low_stock_threshold=15,
                    unit_of_measure=UnitOfMeasure.PCS, status=ProductStatus.ACTIVE,
                ),
            ]
            session.add_all(seed_products)
            await session.commit()
            print(f"  Seeded {len(seed_products)} products.")
        else:
            print(f"  {len(existing_products)} products already exist — skipping.")

        # --- Transactions ---
        tx_result = await session.execute(
            select(Transaction).where(Transaction.company_id == first_company.id)
        )
        existing_txs = tx_result.scalars().all()

        if not existing_txs:
            now = datetime.utcnow()
            txs = []
            for i in range(6):
                month_start = (now - timedelta(days=30 * (5 - i))).replace(
                    day=1, hour=0, minute=0, second=0, microsecond=0
                )
                for _ in range(8):
                    channel = random.choice(list(TransactionChannel))
                    amount = Decimal(str(round(random.uniform(20, 250), 2)))
                    txs.append(Transaction(
                        company_id=first_company.id,
                        amount=amount,
                        type=TransactionType.SALE,
                        channel=channel,
                        created_at=month_start + timedelta(
                            days=random.randint(0, 27), hours=random.randint(0, 23)
                        ),
                    ))
            session.add_all(txs)
            await session.commit()
            print(f"  Seeded {len(txs)} transactions.")
        else:
            print(f"  {len(existing_txs)} transactions already exist — skipping.")

    print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(seed_data())
