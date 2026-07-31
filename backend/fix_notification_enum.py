"""
Migration script: Add missing values to the 'notificationtype' enum in PostgreSQL.
The Python model defines these values but they were never added to the DB enum.
"""
import asyncio
from app.database import engine

async def run():
    async with engine.begin() as conn:
        # First, check what values currently exist in the enum
        result = await conn.execute(
            __import__('sqlalchemy').text(
                "SELECT enumlabel FROM pg_enum "
                "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
                "WHERE pg_type.typname = 'notificationtype'"
            )
        )
        existing = {row[0] for row in result.fetchall()}
        print(f"Existing enum values: {existing}")

        # All values that should exist
        desired = {
            'LOW_STOCK',
            'OUT_OF_STOCK',
            'SYSTEM',
            'CUSTOMER_REGISTERED',
            'VIP_STATUS',
            'CUSTOMER_INACTIVE',
            'FIRST_PURCHASE',
        }

        missing = desired - existing
        print(f"Missing enum values to add: {missing}")

        for value in missing:
            print(f"  Adding '{value}'...")
            await conn.execute(
                __import__('sqlalchemy').text(
                    f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{value}'"
                )
            )
            print(f"  Done: '{value}'")

        # Verify
        result2 = await conn.execute(
            __import__('sqlalchemy').text(
                "SELECT enumlabel FROM pg_enum "
                "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
                "WHERE pg_type.typname = 'notificationtype'"
            )
        )
        final = {row[0] for row in result2.fetchall()}
        print(f"\nFinal enum values in DB: {final}")
        print("Migration complete!")

asyncio.run(run())
