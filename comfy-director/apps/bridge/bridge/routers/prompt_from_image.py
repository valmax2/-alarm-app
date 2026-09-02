from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.ai_providers import (
    DecryptionError,
    UnsupportedProviderKindError,
    VisionHTTPError,
    VisionProtocolError,
    VisionTimeout,
    VisionUnreachable,
    analyze_image_to_prompt,
    decrypt_secret,
    load_or_create_master_key,
)
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.models import AIProviderRecord
from bridge.schemas import PromptFromImageResponse, StructuredPromptOut

router = APIRouter(prefix="/prompt-from-image", tags=["prompt-from-image"])


@router.post("/analyze", response_model=PromptFromImageResponse)
async def analyze_image(
    file: UploadFile = File(...),
    provider_id: str = Form(...),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> PromptFromImageResponse:
    """PROMPT DA IMMAGINE (spec §9): analizza un'immagine caricata con il provider AI
    (cloud) scelto dall'utente, producendo un prompt strutturato + un prompt finale in
    inglese. Nessun'analisi finta: se il provider non è configurato o la chiamata
    fallisce, l'errore reale è restituito, mai un risultato inventato.
    """
    provider = await session.get(AIProviderRecord, provider_id)
    if provider is None:
        raise HTTPException(
            status_code=404,
            detail="Provider AI non trovato. Vai su Impostazioni per aggiungerne uno.",
        )
    if not provider.enabled:
        raise HTTPException(status_code=409, detail=f"Il provider '{provider.label}' è disattivato.")
    if provider.kind not in ("anthropic", "openai"):
        raise HTTPException(
            status_code=409,
            detail=f"Provider di tipo '{provider.kind}' non ancora supportato per l'analisi immagine in questa fase.",
        )
    if provider.encrypted_api_key is None:
        raise HTTPException(status_code=409, detail=f"Il provider '{provider.label}' non ha una API key configurata.")

    try:
        key = load_or_create_master_key(settings.secret_key_path)
        api_key = decrypt_secret(provider.encrypted_api_key, key)
    except DecryptionError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    image_bytes = await file.read()
    media_type = file.content_type if file.content_type and file.content_type.startswith("image/") else "image/png"
    image_base64 = base64.b64encode(image_bytes).decode("ascii")

    try:
        structured = await analyze_image_to_prompt(
            kind=provider.kind, api_key=api_key, image_base64=image_base64, media_type=media_type,
            base_url=provider.base_url, model=provider.default_model,
        )
    except UnsupportedProviderKindError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except VisionUnreachable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except VisionTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except VisionHTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except VisionProtocolError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return PromptFromImageResponse(
        provider_id=provider.id, provider_kind=provider.kind,
        structured=StructuredPromptOut(
            subject=structured.subject, identity=structured.identity, hair=structured.hair,
            face=structured.face, body_clothing=structured.body_clothing, pose_action=structured.pose_action,
            environment=structured.environment, camera=structured.camera, light=structured.light,
            style=structured.style, details=structured.details, final_prompt_en=structured.final_prompt_en,
        ),
    )
