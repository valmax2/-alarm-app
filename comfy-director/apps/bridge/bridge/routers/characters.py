"""Libreria Personaggi (Fase 7, spec §7/§17): CRUD + immagini reali su filesystem.

Nessun collegamento al Workflow Builder / "Coerenza Personaggio" in questa consegna —
quel flusso dipende dal Workflow Intelligence Engine (Fase 5 completa, non ancora
costruito): un personaggio qui è solo dati (nome, tag, immagini), non ancora
utilizzabile per guidare una generazione. Dichiarato esplicitamente, mai finto.
"""

from __future__ import annotations

import json
import mimetypes

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.characters import (
    delete_character_directory,
    delete_character_image,
    save_character_image,
)
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.models import CharacterImageRecord, CharacterRecord
from bridge.schemas import (
    CharacterCreateRequest,
    CharacterDetailOut,
    CharacterImageOut,
    CharacterSummaryOut,
    CharacterUpdateRequest,
)

router = APIRouter(prefix="/characters", tags=["characters"])


def _image_out(record: CharacterImageRecord) -> CharacterImageOut:
    return CharacterImageOut(
        id=record.id, character_id=record.character_id, role=record.role, order_index=record.order_index,
        source=record.source, width=record.width, height=record.height, created_at=record.created_at,
    )


async def _summary(session: AsyncSession, record: CharacterRecord) -> CharacterSummaryOut:
    count_stmt = select(CharacterImageRecord.id).where(CharacterImageRecord.character_id == record.id)
    image_count = len((await session.execute(count_stmt)).all())
    return CharacterSummaryOut(
        id=record.id, name=record.name, description=record.description, tags=json.loads(record.tags),
        is_private=record.is_private, image_count=image_count, main_image_id=record.main_image_id,
        created_at=record.created_at, updated_at=record.updated_at,
    )


@router.post("", response_model=CharacterSummaryOut)
async def create_character(
    payload: CharacterCreateRequest, session: AsyncSession = Depends(get_db_session)
) -> CharacterSummaryOut:
    record = CharacterRecord(
        name=payload.name, description=payload.description, tags=json.dumps(payload.tags),
        notes=payload.notes, is_private=payload.is_private,
    )
    session.add(record)
    await session.flush()
    return await _summary(session, record)


@router.get("", response_model=list[CharacterSummaryOut])
async def list_characters(session: AsyncSession = Depends(get_db_session)) -> list[CharacterSummaryOut]:
    rows = (await session.execute(select(CharacterRecord).order_by(CharacterRecord.updated_at.desc()))).scalars().all()
    return [await _summary(session, r) for r in rows]


@router.get("/{character_id}", response_model=CharacterDetailOut)
async def get_character(character_id: str, session: AsyncSession = Depends(get_db_session)) -> CharacterDetailOut:
    record = await session.get(CharacterRecord, character_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Personaggio non trovato")
    images = (
        await session.execute(
            select(CharacterImageRecord)
            .where(CharacterImageRecord.character_id == character_id)
            .order_by(CharacterImageRecord.order_index)
        )
    ).scalars().all()
    summary = await _summary(session, record)
    return CharacterDetailOut(**summary.model_dump(), notes=record.notes, images=[_image_out(i) for i in images])


@router.put("/{character_id}", response_model=CharacterSummaryOut)
async def update_character(
    character_id: str, payload: CharacterUpdateRequest, session: AsyncSession = Depends(get_db_session)
) -> CharacterSummaryOut:
    record = await session.get(CharacterRecord, character_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Personaggio non trovato")
    if payload.name is not None:
        record.name = payload.name
    if payload.description is not None:
        record.description = payload.description
    if payload.tags is not None:
        record.tags = json.dumps(payload.tags)
    if payload.notes is not None:
        record.notes = payload.notes
    if payload.is_private is not None:
        record.is_private = payload.is_private
    await session.flush()
    return await _summary(session, record)


@router.delete("/{character_id}", status_code=204)
async def delete_character(
    character_id: str, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> None:
    record = await session.get(CharacterRecord, character_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Personaggio non trovato")
    await session.delete(record)
    await session.flush()
    # Cancellato SOLO dopo che la riga DB è stata rimossa con successo: mai file
    # orfani, ma anche mai una cancellazione fisica prematura se il DB fallisse.
    delete_character_directory(settings.storage_dir, character_id)


@router.post("/{character_id}/images", response_model=CharacterImageOut)
async def upload_character_image(
    character_id: str,
    file: UploadFile = File(...),
    role: str = Form("reference"),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> CharacterImageOut:
    character = await session.get(CharacterRecord, character_id)
    if character is None:
        raise HTTPException(status_code=404, detail="Personaggio non trovato")
    if role not in ("main", "reference"):
        raise HTTPException(status_code=422, detail="role deve essere 'main' o 'reference'")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="File vuoto")

    relative_path = save_character_image(settings.storage_dir, character_id, data, file.filename, file.content_type)

    order_index = len(
        (await session.execute(select(CharacterImageRecord.id).where(CharacterImageRecord.character_id == character_id))).all()
    )
    image = CharacterImageRecord(
        character_id=character_id, storage_path=relative_path, role=role, order_index=order_index, source="upload",
    )
    session.add(image)
    await session.flush()

    if role == "main" or character.main_image_id is None:
        character.main_image_id = image.id
    await session.flush()

    return _image_out(image)


@router.delete("/{character_id}/images/{image_id}", status_code=204)
async def delete_character_image_endpoint(
    character_id: str, image_id: str, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> None:
    image = await session.get(CharacterImageRecord, image_id)
    if image is None or image.character_id != character_id:
        raise HTTPException(status_code=404, detail="Immagine non trovata")

    character = await session.get(CharacterRecord, character_id)
    relative_path = image.storage_path
    await session.delete(image)
    if character is not None and character.main_image_id == image_id:
        character.main_image_id = None
    await session.flush()
    delete_character_image(settings.storage_dir, relative_path)


@router.get("/{character_id}/images/{image_id}/file")
async def get_character_image_file(
    character_id: str, image_id: str, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> Response:
    image = await session.get(CharacterImageRecord, image_id)
    if image is None or image.character_id != character_id:
        raise HTTPException(status_code=404, detail="Immagine non trovata")
    path = settings.storage_dir / image.storage_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="File immagine mancante su disco")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return Response(content=path.read_bytes(), media_type=media_type)
