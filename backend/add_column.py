import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://retailpulse:retailpulse@localhost:5432/retailpulse')
    try:
        await conn.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;')
        await conn.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock INTEGER NOT NULL DEFAULT 0;')
        print("Columns checked and added successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
