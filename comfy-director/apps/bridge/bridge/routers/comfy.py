from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.comfy_client import (
    ComfyClient,
    ComfyHTTPError,
    ComfyProtocolError,
    ComfyTimeout,
    ComfyUnreachable,
)
from bridge.comfy_instance import get_or_create_default_instance
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.inventory import sync_inventory
from bridge.inventory.sync import NothingToSyncError
from bridge.schemas import ComfyStatusResponse, SyncResponse

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
    instance = await get_or_create_default_instance(session, settings.default_comfy_base_url)
    base_url = instance.base_url
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


@router.post("/sync", response_model=SyncResponse)
async def sync_comfy(
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SyncResponse:
    """SINCRONIZZA COMFYUI (spec §3): legge davvero nodi e modelli dall'istanza
    configurata E/O dal percorso ComfyUI sul filesystem, se impostato — le due fonti
    sono indipendenti (vedi bridge.inventory.sync): se ComfyUI è spento ma un percorso
    filesystem valido è configurato, la sync riesce comunque (comfy_status="offline"
    nel risultato, dato reale, mai nascosto). Fallisce con un errore chiaro solo se
    NESSUNA delle due fonti produce dati — mai un report "riuscito" con dati inventati.
    """
    instance = await get_or_create_default_instance(session, settings.default_comfy_base_url)
    base_url = instance.base_url
    client = ComfyClient(base_url, timeout_seconds=settings.comfy_object_info_timeout_seconds)

    try:
        report = await sync_inventory(session, client, base_url)
    except NothingToSyncError as exc:
        comfy_error = exc.comfy_error
        if isinstance(comfy_error, ComfyUnreachable):
            raise HTTPException(status_code=503, detail=f"ComfyUI non raggiungibile su {base_url}") from exc
        if isinstance(comfy_error, ComfyTimeout):
            raise HTTPException(status_code=504, detail="Timeout durante la sincronizzazione con ComfyUI") from exc
        if isinstance(comfy_error, ComfyHTTPError):
            raise HTTPException(
                status_code=502, detail=f"ComfyUI ha risposto con errore HTTP {comfy_error.status_code}"
            ) from exc
        raise HTTPException(status_code=502, detail=f"Risposta di ComfyUI non riconosciuta: {comfy_error}") from exc

    return SyncResponse(
        comfy_status=report.comfy_status,
        comfy_version=report.comfy_version,
        node_count=report.node_count,
        custom_node_count=report.custom_node_count,
        model_count=report.model_count,
        model_counts_by_type=report.model_counts_by_type,
        filesystem_scan_used=report.filesystem_scan_used,
        synced_at=report.synced_at,
    )
