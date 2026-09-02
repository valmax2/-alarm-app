"""Diagnostica applicativa (Fase 11 v1, spec §25/§34: "logging/diagnostica dal primo
giorno" — regola non negoziabile). La tabella `errors` (`ErrorLogRecord`) esiste dallo
schema iniziale (Fase 1) ma non era mai stata popolata da nessuna parte del codice:
questo modulo la rende reale.

v1 cattura SOLO eccezioni non gestite (crash-level, via l'exception handler globale
registrato in `main.py`) — dichiarato esplicitamente: gli errori già gestiti e
convertiti in una risposta HTTP pulita (404/409/502/...) dai singoli router NON sono
ancora loggati qui (sono già comunicati onestamente all'utente al momento stesso,
quindi non sono un buco di diagnostica; estendere la cattura a quei casi resta un
miglioramento futuro, non fatto ora per non gonfiare la tabella con eventi già gestiti
correttamente altrove)."""

from __future__ import annotations

import json
import traceback
from datetime import UTC, datetime

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bridge.logging_config import redact
from bridge.models import ErrorLogRecord


async def record_error(
    session: AsyncSession, level: str, source: str, message: str, context: dict | None = None,
) -> ErrorLogRecord:
    """Persiste una riga in `errors`. `message`/`context` vengono redatti (stesso
    `redact()` usato per i log JSON su file, coerente con la regola "mai un segreto nei
    log", spec §20/§29) prima della scrittura."""
    record = ErrorLogRecord(
        level=level, source=source, message=redact(message),
        context_json=json.dumps({k: redact(str(v)) for k, v in context.items()}) if context else None,
    )
    session.add(record)
    await session.flush()
    return record


async def handle_unhandled_exception(
    request: Request, exc: Exception, session_factory: async_sessionmaker[AsyncSession],
) -> JSONResponse:
    """Exception handler globale: persiste l'eccezione (traceback incluso, redatto) e
    restituisce un 500 generico — mai un traceback esposto al client (§34), ma mai
    perso senza traccia (§25). Usa una sessione FRESCA (non quella della request, che
    potrebbe essere in uno stato inconsistente dopo l'eccezione)."""
    tb = redact("".join(traceback.format_exception(type(exc), exc, exc.__traceback__)))
    async with session_factory() as session:
        try:
            await record_error(
                session, level="error", source=f"{request.method} {request.url.path}",
                message=str(exc) or type(exc).__name__,
                context={"traceback": tb[-4000:]},  # troncato: mai una riga illimitata
            )
            await session.commit()
        except Exception:  # noqa: BLE001 — ultima rete di sicurezza deliberata: se anche
            # la scrittura diagnostica fallisce (es. DB non raggiungibile), non deve
            # mascherare l'errore originale né far cadere l'exception handler stesso.
            await session.rollback()

    return JSONResponse(
        status_code=500,
        content={"detail": "Errore interno del Bridge. Vedi Diagnostica per i dettagli."},
    )


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
