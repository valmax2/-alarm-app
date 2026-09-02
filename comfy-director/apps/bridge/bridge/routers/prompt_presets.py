"""Preset di prompt riutilizzabili (Fase 9 v2, spec §9): colma la lacuna dichiarata
esplicitamente in Fase 9 ("nessun preset di prompt con categorie/tag").

Distinto da `routers/prompts.py` (la cronologia, popolata automaticamente ad ogni
salvataggio): un preset è curato dall'utente — nome, categoria opzionale, tag — pensato
per essere richiamato rapidamente invece di riscrivere/ritradurre un prompt da zero.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.deps import get_db_session
from bridge.models import PromptPresetRecord
from bridge.schemas import PromptPresetCreateRequest, PromptPresetOut, PromptPresetUpdateRequest

router = APIRouter(prefix="/prompt-presets", tags=["prompt-presets"])


def _to_out(record: PromptPresetRecord) -> PromptPresetOut:
    return PromptPresetOut(
        id=record.id, name=record.name, category=record.category, tags=json.loads(record.tags),
        text_it=record.text_it, text_en=record.text_en, negative_text_en=record.negative_text_en,
        created_at=record.created_at, updated_at=record.updated_at,
    )


@router.post("", response_model=PromptPresetOut)
async def create_preset(
    payload: PromptPresetCreateRequest, session: AsyncSession = Depends(get_db_session)
) -> PromptPresetOut:
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Il nome del preset non può essere vuoto")
    if not payload.text_en.strip():
        raise HTTPException(status_code=422, detail="text_en non può essere vuoto")
    record = PromptPresetRecord(
        name=payload.name.strip(), category=payload.category, tags=json.dumps(payload.tags),
        text_it=payload.text_it, text_en=payload.text_en, negative_text_en=payload.negative_text_en,
    )
    session.add(record)
    await session.flush()
    return _to_out(record)


@router.get("", response_model=list[PromptPresetOut])
async def list_presets(
    session: AsyncSession = Depends(get_db_session),
    category: str | None = Query(default=None),
    tag: str | None = Query(default=None, description="Filtra per un singolo tag."),
    q: str | None = Query(default=None, description="Ricerca testuale sul nome del preset."),
) -> list[PromptPresetOut]:
    stmt = select(PromptPresetRecord)
    if category:
        stmt = stmt.where(PromptPresetRecord.category == category)
    if q:
        stmt = stmt.where(PromptPresetRecord.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(PromptPresetRecord.name)
    rows = (await session.execute(stmt)).scalars().all()
    presets = [_to_out(r) for r in rows]
    if tag:
        # Filtro su `tags` fatto qui, non in SQL: è un JSON dentro una colonna testo,
        # niente confronto nativo su liste in SQLite (coerente con il resto del
        # modulo — mai una query SQL su un formato che il dialetto non supporta).
        presets = [p for p in presets if tag in p.tags]
    return presets


@router.get("/tags", response_model=list[str])
async def list_preset_tags(session: AsyncSession = Depends(get_db_session)) -> list[str]:
    """Tutti i tag distinti usati almeno una volta — per popolare un filtro/suggerimento
    in UI senza dover indovinare quali tag esistono."""
    rows = (await session.execute(select(PromptPresetRecord.tags))).scalars().all()
    tags: set[str] = set()
    for raw in rows:
        tags.update(json.loads(raw))
    return sorted(tags)


@router.put("/{preset_id}", response_model=PromptPresetOut)
async def update_preset(
    preset_id: str, payload: PromptPresetUpdateRequest, session: AsyncSession = Depends(get_db_session)
) -> PromptPresetOut:
    record = await session.get(PromptPresetRecord, preset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Preset non trovato")
    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(status_code=422, detail="Il nome del preset non può essere vuoto")
        record.name = payload.name.strip()
    if payload.category is not None:
        record.category = payload.category
    if payload.tags is not None:
        record.tags = json.dumps(payload.tags)
    if payload.text_it is not None:
        record.text_it = payload.text_it
    if payload.text_en is not None:
        if not payload.text_en.strip():
            raise HTTPException(status_code=422, detail="text_en non può essere vuoto")
        record.text_en = payload.text_en
    if payload.negative_text_en is not None:
        record.negative_text_en = payload.negative_text_en
    await session.flush()
    return _to_out(record)


@router.delete("/{preset_id}", status_code=204)
async def delete_preset(preset_id: str, session: AsyncSession = Depends(get_db_session)) -> None:
    record = await session.get(PromptPresetRecord, preset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Preset non trovato")
    await session.delete(record)
