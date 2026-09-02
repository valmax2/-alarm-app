"""Chat con l'Assistente AI (Fase 10 v1, spec §21) — SOLO conversazione testuale.

Nessun AI Tool Layer qui: l'assistente non può ancora leggere/modificare il workflow
dell'utente (vedi bridge/ai_providers/chat.py per il motivo). Riusa l'astrazione
provider della Fase 9 (stessa tabella `ai_providers`, stessa cifratura chiave).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.ai_providers import (
    ChatHTTPError,
    ChatMessageIn,
    ChatProtocolError,
    ChatTimeout,
    ChatUnreachable,
    DecryptionError,
    UnsupportedChatProviderKindError,
    decrypt_secret,
    load_or_create_master_key,
    send_chat_message,
)
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.models import AIProviderRecord, ChatMessageRecord
from bridge.schemas import ChatMessageOut, ChatSendRequest

router = APIRouter(prefix="/chat", tags=["chat"])

# Quanti messaggi precedenti passare come contesto ad ogni chiamata — limite pratico
# per non far crescere costo/latenza senza controllo, non un limite architetturale.
_HISTORY_LIMIT = 20


def _to_out(record: ChatMessageRecord) -> ChatMessageOut:
    return ChatMessageOut(
        id=record.id, role=record.role, text=record.text, provider_id=record.provider_id,
        error_message=record.error_message, created_at=record.created_at,
    )


@router.get("/messages", response_model=list[ChatMessageOut])
async def list_messages(session: AsyncSession = Depends(get_db_session)) -> list[ChatMessageOut]:
    rows = (await session.execute(select(ChatMessageRecord).order_by(ChatMessageRecord.created_at))).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("/messages", response_model=list[ChatMessageOut])
async def send_message(
    payload: ChatSendRequest, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> list[ChatMessageOut]:
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="Il messaggio non può essere vuoto")

    provider = await session.get(AIProviderRecord, payload.provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider AI non trovato. Vai su Impostazioni per aggiungerne uno.")
    if not provider.enabled:
        raise HTTPException(status_code=409, detail=f"Il provider '{provider.label}' è disattivato.")
    if provider.kind not in ("anthropic", "openai"):
        raise HTTPException(
            status_code=409, detail=f"Provider di tipo '{provider.kind}' non ancora supportato per la chat in questa fase."
        )
    if provider.encrypted_api_key is None:
        raise HTTPException(status_code=409, detail=f"Il provider '{provider.label}' non ha una API key configurata.")

    # Il messaggio dell'utente viene persistito e COMMITTATO subito (non solo
    # flush), indipendentemente dall'esito della chiamata al provider: è
    # un'intenzione reale, non va perso se la chiamata fallisce (l'utente non deve
    # doverlo riscrivere). Un semplice flush non basterebbe: `get_db_session`
    # (bridge/deps.py) fa rollback dell'intera sessione se l'endpoint solleva
    # un'eccezione più avanti (es. HTTPException per un errore del provider).
    user_message = ChatMessageRecord(role="user", text=payload.text.strip())
    session.add(user_message)
    await session.commit()

    prior = (
        (await session.execute(select(ChatMessageRecord).order_by(ChatMessageRecord.created_at.desc()).limit(_HISTORY_LIMIT)))
        .scalars().all()
    )
    history = [ChatMessageIn(role=m.role, text=m.text) for m in reversed(prior)]

    try:
        key = load_or_create_master_key(settings.secret_key_path)
        api_key = decrypt_secret(provider.encrypted_api_key, key)
    except DecryptionError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        reply_text = await send_chat_message(
            kind=provider.kind, api_key=api_key, history=history,
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

    assistant_message = ChatMessageRecord(role="assistant", text=reply_text, provider_id=provider.id)
    session.add(assistant_message)
    await session.flush()

    return [_to_out(user_message), _to_out(assistant_message)]


@router.delete("/messages", status_code=204)
async def clear_messages(session: AsyncSession = Depends(get_db_session)) -> None:
    rows = (await session.execute(select(ChatMessageRecord))).scalars().all()
    for row in rows:
        await session.delete(row)
