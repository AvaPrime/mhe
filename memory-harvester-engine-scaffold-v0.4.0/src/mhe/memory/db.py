from __future__ import annotations
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from mhe.common.config import settings
from mhe.memory.models import Base

def make_db_url() -> str:
    return f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"

engine = create_async_engine(make_db_url(), echo=False, future=True, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def init_db():
    # Dev convenience: create schema and extensions if missing; for prod use Alembic.
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS mhe"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncSession:
    async with Session() as session:
        yield session

if __name__ == "__main__":
    asyncio.run(init_db())
