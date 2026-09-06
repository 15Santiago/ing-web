import os
from contextlib import asynccontextmanager
from pathlib import Path

import aiomysql
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

_pool = None


async def get_pool():
    global _pool
    if _pool is None:
        _pool = await aiomysql.create_pool(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            db=os.getenv("DB_NAME", "notasAcademicas"),
            minsize=1,
            maxsize=10,
            autocommit=True,
        )
    return _pool


@asynccontextmanager
async def connection():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            yield conn, cursor


async def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None
