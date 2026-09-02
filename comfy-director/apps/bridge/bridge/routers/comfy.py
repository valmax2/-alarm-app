from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.comfy_client import (
    ComfyClient,
    ComfyHTTPError,
    ComfyProtocolError,
    ComfyTimeout,
    ComfyUnreachable,
)
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.routers.settings import read_comfy_base_url
from bridge.schemas import ComfyStatusResponse

router = APIRouter(prefix="/comfy", tags=["comfy"])
logger = logging.getLogger(__name__)


@router.get("/status", response_model=ComfyStatusResponse)
async def get_comfy_status(
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ComfyStatusResponse:
    """Stato REALE di ComfyUI: interroga /system_stats sull'URL configurato.

    Non inventa mai numeri/versione: se la chiamata fallisce, `status` è "offline" con
    un `reason` leggibile che distingue "non raggiungibile" da "timeout" da "risposta
    inattesa" (spec §3, §34).
    """
    base_url = await read_comfy_base_url(session, settings)
    client = ComfyClient(base_url, timeout_seconds=settings.comfy_request_timeout_seconds)
    checked_at = datetime.now(UTC)

    try:
        stats = await client.get_system_stats()
    except ComfyUnreachable:
        return ComfyStatusResponse(
            status="offline", reason="ComfyUI non raggiungibile su questo indirizzo",
            base_url=base_url, checked_at=checked_at,
        )
    except ComfyTimeout:
        return ComfyStatusResponse(
            status="offline", reason="Timeout in attesa di risposta da ComfyUI",
            base_url=base_url, checked_at=checked_at,
        )
    except ComfyHTTPError as exc:
        return ComfyStatusResponse(
            status="offline",
            reason=f"ComfyUI ha risposto con errore HTTP {exc.status_code}",
            base_url=base_url, checked_at=checked_at,
        )
    except ComfyProtocolError as exc:
        logger.warning("Risposta inattesa da ComfyUI: %s", exc)
        return ComfyStatusResponse(
            status="offline",
            reason="Risposta di ComfyUI non riconosciuta (versione non supportata?)",
            base_url=base_url, checked_at=checked_at,
        )

    return ComfyStatusResponse(
        status="online",
        base_url=base_url,
        version=stats.version,
        os=stats.os,
        python_version=stats.python_version,
        pytorch_version=stats.pytorch_version,
        checked_at=checked_at,
    )
