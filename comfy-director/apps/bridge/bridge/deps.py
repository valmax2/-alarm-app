"""Dependency injection FastAPI condivisa tra i router.

La session factory e le Settings vivono su `app.state`, impostate in `main.py` (o dai
fixture di test) — mai un singleton globale mutato a runtime dai test, per poter isolare
completamente ogni test con il proprio DB in-memory.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.config import Settings


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_settings(request: Request) -> Settings:
    return request.app.state.settings
