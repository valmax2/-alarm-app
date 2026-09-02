"""Entry point dell'applicazione FastAPI del Bridge.

Avvio: `uvicorn bridge.main:app --reload` (dev) oppure tramite
`scripts/START_BRIDGE.bat` su Windows. Vedi apps/bridge/README.md.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from bridge import __version__
from bridge.config import Settings, get_settings
from bridge.db import make_engine, make_session_factory
from bridge.logging_config import configure_logging
from bridge.routers import (
    ai_providers,
    characters,
    chat,
    comfy,
    generations,
    health,
    inventory,
    prompt_from_image,
    prompts,
    workflow_import,
    workflows,
)
from bridge.routers import settings as settings_router

logger = logging.getLogger(__name__)

_BRIDGE_DIR = Path(__file__).resolve().parents[1]  # apps/bridge


def run_migrations() -> None:
    """Applica le migrazioni Alembic (schema reale, versionato — mai create_all "silenzioso"
    in produzione). Chiamata a livello di modulo, prima che l'app venga servita.

    Alembic gestisce da solo l'engine async al suo interno (vedi migrations/env.py, che
    fa `asyncio.run(...)` e legge la data_dir dal singleton `get_settings()`), il che
    fallisce se chiamato da dentro un event loop già in corso. Questo capita in un caso
    reale e comune: `uvicorn --reload` (usato da scripts/dev.sh) carica il modulo
    dell'app DENTRO il proprio event loop async, a differenza dell'avvio senza reload
    (dove il modulo è importato prima che il loop parta). Per funzionare in entrambi i
    casi, se un loop è già in esecuzione le migrazioni vengono eseguite in un thread
    separato (che non ha un loop proprio, quindi `asyncio.run` lì funziona normalmente).
    """
    alembic_cfg = AlembicConfig(str(_BRIDGE_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(_BRIDGE_DIR / "migrations"))

    def _upgrade() -> None:
        alembic_command.upgrade(alembic_cfg, "head")

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        _upgrade()  # nessun loop in corso: caso comune (avvio senza --reload, test)
    else:
        with ThreadPoolExecutor(max_workers=1) as executor:
            executor.submit(_upgrade).result()


def build_app(settings: Settings, engine: AsyncEngine, session_factory: async_sessionmaker[AsyncSession]) -> FastAPI:
    """Assembla l'app FastAPI a partire da un engine/session_factory già pronti.

    Separata da `create_app()` per permettere ai test di costruire un'app con un
    database isolato (in-memory) senza passare da Alembic/filesystem reale.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logger.info("Bridge avviato", extra={"context": {"version": __version__}})
        yield
        await engine.dispose()
        logger.info("Bridge arrestato")

    app = FastAPI(
        title="Comfy Director Bridge",
        version=__version__,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.session_factory = session_factory

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(comfy.router)
    app.include_router(settings_router.router)
    app.include_router(inventory.router)
    app.include_router(workflow_import.router)
    app.include_router(ai_providers.router)
    app.include_router(prompt_from_image.router)
    app.include_router(workflows.router)
    app.include_router(generations.router)
    app.include_router(chat.router)
    app.include_router(characters.router)
    app.include_router(prompts.router)

    # In produzione, se il frontend è stato buildato (apps/frontend/dist), il Bridge lo
    # serve direttamente così l'utente apre un solo URL/processo (coerente con "avviare
    # il sistema senza usare manualmente terminali complessi", spec §3). In sviluppo si
    # usa invece `npm run dev` (Vite) separatamente: se `dist/` non esiste, il Bridge
    # resta una pura API, senza fingere di servire una UI che non ha buildato.
    frontend_dist = Path(__file__).resolve().parents[3] / "apps" / "frontend" / "dist"
    if frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_dir)

    run_migrations()

    engine = make_engine(settings.resolved_database_url())
    session_factory = make_session_factory(engine)
    return build_app(settings, engine, session_factory)


app = create_app()
