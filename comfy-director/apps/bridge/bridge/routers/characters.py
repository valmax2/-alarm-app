"""Libreria Personaggi (Fase 7, spec §7/§17): CRUD + immagini reali su filesystem.

Nessun collegamento al Workflow Builder / "Coerenza Personaggio" in questa consegna —
quel flusso dipende dal Workflow Intelligence Engine (Fase 5 completa, non ancora
costruito): un personaggio qui è solo dati (nome, tag, immagini), non ancora
utilizzabile per guidare una generazione. Dichiarato esplicitamente, mai finto.

Fase 7 v2 aggiunge export/import Character Pack (`bridge/characters/pack.py`): un
personaggio si può scaricare come archivio ZIP autonomo e reimportare — sempre come
riga NUOVA (mai riusando gli ID originali, che potrebbero già esistere
sull'installazione di destinazione).
"""

from __future__ import annotations

import json
import mimetypes
import re
import unicodedata

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bridge.characters import (
    CharacterPackError,
    SourceImage,
    build_character_pack,
    delete_character_directory,
    delete_character_image,
    parse_character_pack,
    save_character_image,
)
from bridge.config import Settings
from bridge.deps import get_db_session, get_settings
from bridge.models import CharacterImageRecord, CharacterRecord
from bridge.schemas import (
    CharacterCreateRequest,
    CharacterDetailOut,
    CharacterImageOut,
    CharacterImageUpdateRequest,
    CharacterSummaryOut,
    CharacterUpdateRequest,
)

router = APIRouter(prefix="/characters", tags=["characters"])


def _safe_filename_slug(name: str) -> str:
    """Nome file sicuro per il Content-Disposition dell'export — mai il nome utente
    (potenzialmente non-ASCII o con caratteri problematici) usato alla lettera."""
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^A-Za-z0-9_-]+", "-", normalized).strip("-").lower()
    return slug or "personaggio"


def _image_out(record: CharacterImageRecord) -> CharacterImageOut:
    return CharacterImageOut(
        id=record.id, character_id=record.character_id, role=record.role, order_index=record.order_index,
        source=record.source, width=record.width, height=record.height, is_hidden=record.is_hidden,
        created_at=record.created_at,
    )


async def _summary(session: AsyncSession, record: CharacterRecord) -> CharacterSummaryOut:
    count_stmt = select(CharacterImageRecord.id).where(CharacterImageRecord.character_id == record.id)
    image_count = len((await session.execute(count_stmt)).all())
    return CharacterSummaryOut(
        id=record.id, name=record.name, description=record.description, tags=json.loads(record.tags),
        is_private=record.is_private, image_count=image_count, main_image_id=record.main_image_id,
        created_at=record.created_at, updated_at=record.updated_at,
    )


async def _detail(session: AsyncSession, record: CharacterRecord) -> CharacterDetailOut:
    images = (
        await session.execute(
            select(CharacterImageRecord)
            .where(CharacterImageRecord.character_id == record.id)
            .order_by(CharacterImageRecord.order_index)
        )
    ).scalars().all()
    summary = await _summary(session, record)
    return CharacterDetailOut(**summary.model_dump(), notes=record.notes, images=[_image_out(i) for i in images])


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


@router.post("/import", response_model=CharacterDetailOut)
async def import_character_pack(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> CharacterDetailOut:
    """Importa un Character Pack (Fase 7 v2): crea SEMPRE un personaggio nuovo (nuovo
    id, mai un tentativo di 'aggiornare' un personaggio esistente) — un pack può
    provenire da un'altra installazione, i cui ID non hanno alcun significato qui."""
    data = await file.read()
    try:
        pack = parse_character_pack(data)
    except CharacterPackError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    record = CharacterRecord(
        name=pack.name, description=pack.description, tags=json.dumps(pack.tags),
        notes=pack.notes, is_private=pack.is_private,
    )
    session.add(record)
    await session.flush()

    main_image_id: str | None = None
    for pack_image in sorted(pack.images, key=lambda i: i.order_index):
        relative_path = save_character_image(settings.storage_dir, record.id, pack_image.data, pack_image.filename, None)
        image = CharacterImageRecord(
            character_id=record.id, storage_path=relative_path, role=pack_image.role,
            order_index=pack_image.order_index, source=pack_image.source,
            width=pack_image.width, height=pack_image.height, is_hidden=pack_image.is_hidden,
        )
        session.add(image)
        await session.flush()
        if pack_image.role == "main" or main_image_id is None:
            main_image_id = image.id
    record.main_image_id = main_image_id
    await session.flush()

    return await _detail(session, record)


@router.get("", response_model=list[CharacterSummaryOut])
async def list_characters(session: AsyncSession = Depends(get_db_session)) -> list[CharacterSummaryOut]:
    rows = (await session.execute(select(CharacterRecord).order_by(CharacterRecord.updated_at.desc()))).scalars().all()
    return [await _summary(session, r) for r in rows]


@router.get("/{character_id}", response_model=CharacterDetailOut)
async def get_character(character_id: str, session: AsyncSession = Depends(get_db_session)) -> CharacterDetailOut:
    record = await session.get(CharacterRecord, character_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Personaggio non trovato")
    return await _detail(session, record)


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


@router.put("/{character_id}/images/{image_id}", response_model=CharacterImageOut)
async def update_character_image(
    character_id: str, image_id: str, payload: CharacterImageUpdateRequest, session: AsyncSession = Depends(get_db_session)
) -> CharacterImageOut:
    """Oscuramento per SINGOLA immagine (indipendente dal toggle `is_private` del
    personaggio, che oscura tutte le immagini insieme) — richiesto esplicitamente."""
    image = await session.get(CharacterImageRecord, image_id)
    if image is None or image.character_id != character_id:
        raise HTTPException(status_code=404, detail="Immagine non trovata")
    image.is_hidden = payload.is_hidden
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


@router.get("/{character_id}/export")
async def export_character_pack(
    character_id: str, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)
) -> Response:
    """Esporta il personaggio come Character Pack ZIP (Fase 7 v2) — fallisce con un
    errore chiaro (mai un pack silenziosamente incompleto) se un'immagine referenziata
    a DB manca sul disco: uno stato inconsistente che l'utente deve poter vedere."""
    character = await session.get(CharacterRecord, character_id)
    if character is None:
        raise HTTPException(status_code=404, detail="Personaggio non trovato")
    images = (
        await session.execute(
            select(CharacterImageRecord)
            .where(CharacterImageRecord.character_id == character_id)
            .order_by(CharacterImageRecord.order_index)
        )
    ).scalars().all()

    source_images: list[SourceImage] = []
    for image in images:
        path = settings.storage_dir / image.storage_path
        if not path.exists():
            raise HTTPException(
                status_code=500,
                detail=f"Impossibile esportare: l'immagine '{image.storage_path}' è referenziata a DB ma manca su disco.",
            )
        source_images.append(
            SourceImage(
                data=path.read_bytes(), original_filename=path.name, role=image.role,
                order_index=image.order_index, source=image.source, width=image.width, height=image.height,
                is_hidden=image.is_hidden,
            )
        )

    zip_bytes = build_character_pack(
        name=character.name, description=character.description, tags=json.loads(character.tags),
        notes=character.notes, is_private=character.is_private, images=source_images,
    )
    filename = f"{_safe_filename_slug(character.name)}.character-pack.zip"
    return Response(
        content=zip_bytes, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
