from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.comfy_instance import get_or_create_default_instance
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.schemas import SettingsResponse, SettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings_endpoint(
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SettingsResponse:
    instance = await get_or_create_default_instance(session, settings.default_comfy_base_url)
    return SettingsResponse(comfy_base_url=instance.base_url, comfy_root_path=instance.root_path)


@router.put("", response_model=SettingsResponse)
async def update_settings_endpoint(
    payload: SettingsUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SettingsResponse:
    instance = await get_or_create_default_instance(session, settings.default_comfy_base_url)
    instance.base_url = payload.comfy_base_url
    instance.root_path = payload.comfy_root_path
    await session.flush()
    return SettingsResponse(comfy_base_url=instance.base_url, comfy_root_path=instance.root_path)
