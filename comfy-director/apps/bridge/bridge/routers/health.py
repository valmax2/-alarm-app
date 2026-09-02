from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from bridge import __version__
from bridge.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Stato del processo Bridge stesso (non di ComfyUI — per quello vedi /comfy/status).

    Rispondere qui significa solo "il processo Bridge è vivo e serve richieste HTTP";
    non implica nulla sulla raggiungibilità di ComfyUI.
    """
    return HealthResponse(version=__version__, time=datetime.now(UTC))
