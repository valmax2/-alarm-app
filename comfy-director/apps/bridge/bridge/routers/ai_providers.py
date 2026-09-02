from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.ai_providers import encrypt_secret, load_or_create_master_key
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.models import AIProviderRecord
from bridge.schemas import AIProviderCreateRequest, AIProviderOut

router = APIRouter(prefix="/ai-providers", tags=["ai-providers"])


def _to_out(record: AIProviderRecord) -> AIProviderOut:
    return AIProviderOut(
        id=record.id, kind=record.kind, label=record.label, base_url=record.base_url,
        default_model=record.default_model, enabled=record.enabled,
        has_api_key=record.encrypted_api_key is not None, created_at=record.created_at,
    )


@router.get("", response_model=list[AIProviderOut])
async def list_providers(session: AsyncSession = Depends(get_db_session)) -> list[AIProviderOut]:
    rows = (await session.execute(select(AIProviderRecord).order_by(AIProviderRecord.created_at))).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=AIProviderOut)
async def create_provider(
    payload: AIProviderCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AIProviderOut:
    """Crea un provider AI (spec §20: chiave inserita dall'utente, mai hardcoded, mai
    loggata, mai restituita in chiaro — cifrata a riposo con una chiave locale)."""
    if payload.kind in ("anthropic", "openai") and not payload.api_key:
        raise HTTPException(status_code=422, detail=f"Il provider '{payload.kind}' richiede una API key")

    encrypted_api_key = None
    if payload.api_key:
        key = load_or_create_master_key(settings.secret_key_path)
        encrypted_api_key = encrypt_secret(payload.api_key, key)

    record = AIProviderRecord(
        kind=payload.kind, label=payload.label, encrypted_api_key=encrypted_api_key,
        base_url=payload.base_url, default_model=payload.default_model, enabled=True,
    )
    session.add(record)
    await session.flush()
    return _to_out(record)


@router.delete("/{provider_id}", status_code=204)
async def delete_provider(provider_id: str, session: AsyncSession = Depends(get_db_session)) -> None:
    record = await session.get(AIProviderRecord, provider_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Provider non trovato")
    await session.delete(record)
