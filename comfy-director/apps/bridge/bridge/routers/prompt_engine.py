"""Smart Prompt Compiler + Coerenza Personaggio (spec §9), portato — riorganizzato in
modo pulito e testabile — da PromptStudio su richiesta esplicita dell'utente.

`GET /prompt-engine/catalog` serve i cataloghi statici (vocabolario di prompt
engineering — non dati derivati da ComfyUI, coerente con `bridge/prompt_engine/
catalogs.py`). `POST /prompt-engine/compose` è un'utility pura come
`POST /prompts/translate`: non persiste nulla, il salvataggio resta un'azione
separata dell'utente (`POST /prompts` o `POST /prompt-presets`).
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.deps import get_db_session
from bridge.models import CharacterRecord
from bridge.prompt_engine import CharacterInfo, StructuredPromptInput, catalogs, compose_prompt
from bridge.schemas import (
    PromptCatalogOptionGroupOut,
    PromptCatalogOptionOut,
    PromptCatalogOut,
    StructuredPromptRequest,
    StructuredPromptResponse,
)

router = APIRouter(prefix="/prompt-engine", tags=["prompt-engine"])


def _opt(option: catalogs.Option) -> PromptCatalogOptionOut:
    return PromptCatalogOptionOut(label_it=option.label_it, value_en=option.value_en)


def _group(group: catalogs.OptionGroup) -> PromptCatalogOptionGroupOut:
    return PromptCatalogOptionGroupOut(key=group.key, label_it=group.label_it, options=[_opt(o) for o in group.options])


@router.get("/catalog", response_model=PromptCatalogOut)
async def get_catalog() -> PromptCatalogOut:
    return PromptCatalogOut(
        body={gender: [_group(g) for g in groups] for gender, groups in catalogs.BODY.items()},
        face=[_group(g) for g in catalogs.FACE],
        hair_categories={label: [_opt(o) for o in opts] for label, opts in catalogs.HAIR_CATEGORIES.items()},
        hair_colors=[_opt(o) for o in catalogs.HAIR_COLORS],
        clothing_states=[_opt(o) for o in catalogs.CLOTHING_STATES],
        underwear_categories={label: [_opt(o) for o in opts] for label, opts in catalogs.UNDERWEAR_CATEGORIES.items()},
        actions=[_opt(o) for o in catalogs.ACTIONS],
        poses=[_opt(o) for o in catalogs.POSES],
        environments=[_opt(o) for o in catalogs.ENVIRONMENTS],
        camera=[_group(g) for g in catalogs.CAMERA],
        lights=[_opt(o) for o in catalogs.LIGHTS],
        negative_default=catalogs.NEGATIVE_DEFAULT,
    )


@router.post("/compose", response_model=StructuredPromptResponse)
async def compose(payload: StructuredPromptRequest, session: AsyncSession = Depends(get_db_session)) -> StructuredPromptResponse:
    character: CharacterInfo | None = None
    if payload.coherent_character_id:
        record = await session.get(CharacterRecord, payload.coherent_character_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Personaggio coerente non trovato")
        character = CharacterInfo(
            name=record.name, description=record.description, tags=_tags(record), notes=record.notes
        )

    structured = StructuredPromptInput(
        gender=payload.gender, age=payload.age, clothing_state=payload.clothing_state,
        underwear_item=payload.underwear_item, body=payload.body, face_mode=payload.face_mode, face=payload.face,
        hair_mode=payload.hair_mode, hair=payload.hair, custom_hair=payload.custom_hair, hair_color=payload.hair_color,
        custom_action=payload.custom_action, action=payload.action, pose=payload.pose, custom_scene=payload.custom_scene,
        environment=payload.environment, custom_photo=payload.custom_photo, camera_framing=payload.camera_framing,
        camera_angle=payload.camera_angle, camera_lens=payload.camera_lens, light=payload.light,
    )
    return StructuredPromptResponse(text_en=compose_prompt(structured, character=character))


def _tags(record: CharacterRecord) -> list[str]:
    try:
        parsed = json.loads(record.tags)
    except (ValueError, TypeError):
        return []
    return parsed if isinstance(parsed, list) else []
