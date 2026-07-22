import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://retailpulse:retailpulse@localhost:5432/retailpulse')
    try:
        await conn.execute('ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5;')
        print("Column added successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
