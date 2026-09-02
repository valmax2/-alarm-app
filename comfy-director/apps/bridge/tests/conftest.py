from __future__ import annotations

from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from bridge.config import Settings
from bridge.db import create_all_for_tests, make_session_factory
from bridge.main import build_app


def _make_in_memory_engine():
    # Un unico engine SQLite in-memory condiviso (StaticPool) così tutte le sessioni
    # della stessa app di test vedono lo stesso database, isolato per test.
    return create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


@pytest_asyncio.fixture
async def test_settings(tmp_path) -> Settings:
    return Settings(data_dir=tmp_path)


@pytest_asyncio.fixture
async def app(test_settings: Settings):
    engine = _make_in_memory_engine()
    await create_all_for_tests(engine)
    session_factory = make_session_factory(engine)
    fastapi_app = build_app(test_settings, engine, session_factory)
    yield fastapi_app
    await engine.dispose()


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
