"""Prompt Engine (Fase 9, spec §9): traduzione IT→EN reale + cronologia prompt.

Indipendente da "Prompt da Immagine" (`routers/prompt_from_image.py`, che analizza
un'immagine) — qui l'utente scrive il prompt lui stesso e lo fa tradurre, o lo scrive
già in inglese. Nessun collegamento a un workflow/generazione specifico in questa
consegna (`generation_id` resta sempre null): dipende dal Workflow Builder completo
(Fase 5), dichiarato esplicitamente.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.ai_providers import (
    ChatHTTPError,
    ChatProtocolError,
    ChatTimeout,
    ChatUnreachable,
    DecryptionError,
    UnsupportedChatProviderKindError,
    decrypt_secret,
    load_or_create_master_key,
    translate_to_english,
)
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.models import AIProviderRecord, PromptRecord
from bridge.schemas import (
    PromptCreateRequest,
    PromptOut,
    PromptUpdateRequest,
    TranslateRequest,
    TranslateResponse,
)

router = APIRouter(tags=["prompts"])


def _to_out(record: PromptRecord) -> PromptOut:
    return PromptOut(
        id=record.id, generation_id=record.generation_id, text_it=record.text_it, text_en=record.text_en,
        negative_text_en=record.negative_text_en, translation_locked=record.translation_locked,
        created_at=record.created_at,
    )


@router.post("/prompts/translate", response_model=TranslateResponse)
async def translate(
    payload: TranslateRequest, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> TranslateResponse:
    """Traduzione IT→EN reale — NON persiste nulla: è un'utility, il salvataggio è
    un'azione separata dell'utente (`POST /prompts`)."""
    if not payload.text_it.strip():
        raise HTTPException(status_code=422, detail="Il testo da tradurre non può essere vuoto")

    provider = await session.get(AIProviderRecord, payload.provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider AI non trovato. Vai su Impostazioni per aggiungerne uno.")
    if not provider.enabled:
        raise HTTPException(status_code=409, detail=f"Il provider '{provider.label}' è disattivato.")
    if provider.kind not in ("anthropic", "openai"):
        raise HTTPException(
            status_code=409, detail=f"Provider di tipo '{provider.kind}' non ancora supportato per la traduzione in questa fase."
        )
    if provider.encrypted_api_key is None:
        raise HTTPException(status_code=409, detail=f"Il provider '{provider.label}' non ha una API key configurata.")

    try:
        key = load_or_create_master_key(settings.secret_key_path)
        api_key = decrypt_secret(provider.encrypted_api_key, key)
    except DecryptionError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        text_en = await translate_to_english(
            kind=provider.kind, api_key=api_key, text_it=payload.text_it,
            base_url=provider.base_url, model=provider.default_model,
        )
    except UnsupportedChatProviderKindError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ChatUnreachable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ChatTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ChatHTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ChatProtocolError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return TranslateResponse(text_en=text_en)


@router.post("/prompts", response_model=PromptOut)
async def create_prompt(payload: PromptCreateRequest, session: AsyncSession = Depends(get_db_session)) -> PromptOut:
    if not payload.text_en.strip():
        raise HTTPException(status_code=422, detail="text_en non può essere vuoto")
    record = PromptRecord(
        text_it=payload.text_it, text_en=payload.text_en, negative_text_en=payload.negative_text_en,
        translation_locked=payload.translation_locked,
    )
    session.add(record)
    await session.flush()
    return _to_out(record)


@router.get("/prompts", response_model=list[PromptOut])
async def list_prompts(session: AsyncSession = Depends(get_db_session)) -> list[PromptOut]:
    rows = (await session.execute(select(PromptRecord).order_by(PromptRecord.created_at.desc()))).scalars().all()
    return [_to_out(r) for r in rows]


@router.put("/prompts/{prompt_id}", response_model=PromptOut)
async def update_prompt(
    prompt_id: str, payload: PromptUpdateRequest, session: AsyncSession = Depends(get_db_session)
) -> PromptOut:
    record = await session.get(PromptRecord, prompt_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Prompt non trovato")
    if payload.text_it is not None:
        record.text_it = payload.text_it
    if payload.text_en is not None:
        record.text_en = payload.text_en
    if payload.negative_text_en is not None:
        record.negative_text_en = payload.negative_text_en
    if payload.translation_locked is not None:
        record.translation_locked = payload.translation_locked
    await session.flush()
    return _to_out(record)


@router.delete("/prompts/{prompt_id}", status_code=204)
async def delete_prompt(prompt_id: str, session: AsyncSession = Depends(get_db_session)) -> None:
    record = await session.get(PromptRecord, prompt_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Prompt non trovato")
    await session.delete(record)
