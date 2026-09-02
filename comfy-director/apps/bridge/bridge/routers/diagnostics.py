"""Diagnostica (Fase 11 v1, spec §25/§34): lettura degli errori persistiti
(`bridge/diagnostics.py`, che li scrive) + un report esportabile."""

from __future__ import annotations

import json
import platform

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge import __version__
from bridge.deps import get_db_session
from bridge.diagnostics import utc_now_iso
from bridge.models import ErrorLogRecord
from bridge.schemas import DiagnosticsReportOut, ErrorLogOut

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


def _to_out(record: ErrorLogRecord) -> ErrorLogOut:
    return ErrorLogOut(
        id=record.id, level=record.level, source=record.source, message=record.message,
        context=json.loads(record.context_json) if record.context_json else None,
        created_at=record.created_at,
    )


@router.get("/errors", response_model=list[ErrorLogOut])
async def list_errors(limit: int = 50, session: AsyncSession = Depends(get_db_session)) -> list[ErrorLogOut]:
    """v1 mostra SOLO le eccezioni non gestite catturate dall'exception handler
    globale (vedi bridge/diagnostics.py) — non gli errori già convertiti in una
    risposta HTTP pulita da un router (404/409/502/...), già comunicati onestamente
    all'utente al momento stesso."""
    bounded_limit = max(1, min(limit, 200))
    rows = (
        await session.execute(select(ErrorLogRecord).order_by(ErrorLogRecord.created_at.desc()).limit(bounded_limit))
    ).scalars().all()
    return [_to_out(r) for r in rows]


@router.get("/report", response_model=DiagnosticsReportOut)
async def get_report(session: AsyncSession = Depends(get_db_session)) -> DiagnosticsReportOut:
    rows = (
        await session.execute(select(ErrorLogRecord).order_by(ErrorLogRecord.created_at.desc()).limit(100))
    ).scalars().all()
    return DiagnosticsReportOut(
        generated_at=utc_now_iso(), app_version=__version__, python_version=platform.python_version(),
        platform=platform.platform(), recent_errors=[_to_out(r) for r in rows],
    )
