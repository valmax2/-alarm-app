from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.models import SettingRecord
from bridge.schemas import SettingsResponse, SettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)

_COMFY_BASE_URL_KEY = "comfy.base_url"


async def _read_comfy_base_url(session: AsyncSession, default: str) -> str:
    row = await session.get(SettingRecord, _COMFY_BASE_URL_KEY)
    if row is None:
        return default
    try:
        return json.loads(row.value)
    except (json.JSONDecodeError, TypeError):
        # Valore corrotto/non atteso: non far cadere l'app, torna al default e logga.
        logger.warning("Valore di %s non decodificabile, uso il default", _COMFY_BASE_URL_KEY)
        return default


@router.get("", response_model=SettingsResponse)
async def get_settings_endpoint(
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SettingsResponse:
    base_url = await _read_comfy_base_url(session, settings.default_comfy_base_url)
    return SettingsResponse(comfy_base_url=base_url)


@router.put("", response_model=SettingsResponse)
async def update_settings_endpoint(
    payload: SettingsUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SettingsResponse:
    existing = await session.get(SettingRecord, _COMFY_BASE_URL_KEY)
    encoded = json.dumps(payload.comfy_base_url)
    if existing is None:
        session.add(SettingRecord(key=_COMFY_BASE_URL_KEY, value=encoded))
    else:
        existing.value = encoded
    await session.flush()
    return SettingsResponse(comfy_base_url=payload.comfy_base_url)


async def read_comfy_base_url(session: AsyncSession, settings: Settings) -> str:
    """Helper riusato dal router /comfy per non duplicare la logica di lettura."""
    return await _read_comfy_base_url(session, settings.default_comfy_base_url)
