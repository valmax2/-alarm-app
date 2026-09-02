"""Character Pack — export/import di un personaggio (Fase 7 v2, colma la lacuna
dichiarata esplicitamente in Fase 7 v1: "nessun export/import Character Pack").

Formato: un archivio ZIP con un manifest `character.json` (dati + metadati delle
immagini) e una cartella `images/` con i file reali — così un personaggio si può
condividere o fare backup tra installazioni diverse del Bridge, senza dipendere da
un path assoluto o da ID che potrebbero già esistere sull'installazione di
destinazione (l'import crea sempre righe NUOVE, mai riusa gli ID originali).

Nessuna logica di rete/HTTP qui dentro (`bridge/characters/` resta puro storage/
formato, coerente con docs/module-boundaries.md) — i router chiamano queste funzioni
pure e gestiscono loro le eccezioni tipizzate.
"""

from __future__ import annotations

import json
import zipfile
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

_MANIFEST_NAME = "character.json"
_IMAGES_DIR = "images"
_FORMAT = "comfy-director-character-pack"
_FORMAT_VERSION = 1


class CharacterPackError(Exception):
    """L'archivio non è un Character Pack valido (o è per un formato/versione che
    questa build non riconosce) — il messaggio è pensato per essere mostrato
    all'utente, mai un import parziale/indovinato su un pack malformato."""


@dataclass(frozen=True)
class PackImage:
    filename: str
    role: str
    order_index: int
    source: str
    width: int | None
    height: int | None
    data: bytes


@dataclass(frozen=True)
class CharacterPack:
    name: str
    description: str | None
    tags: list[str]
    notes: str | None
    is_private: bool
    images: list[PackImage] = field(default_factory=list)


@dataclass(frozen=True)
class SourceImage:
    """Vista minima di un'immagine sorgente per `build_character_pack` — disaccoppiata
    da `CharacterImageRecord` così questo modulo non dipende dagli ORM model."""

    data: bytes
    original_filename: str  # nome file su disco (per l'estensione) — MAI il path assoluto
    role: str
    order_index: int
    source: str
    width: int | None
    height: int | None


def build_character_pack(
    *, name: str, description: str | None, tags: list[str], notes: str | None, is_private: bool,
    images: list[SourceImage],
) -> bytes:
    """Costruisce i byte di un archivio ZIP Character Pack. I file immagine vengono
    rinominati `NNN_<nome originale>` (indice progressivo) nell'archivio — mai il
    percorso di storage interno del Bridge, che non ha significato altrove."""
    manifest: dict[str, Any] = {
        "format": _FORMAT,
        "format_version": _FORMAT_VERSION,
        "name": name,
        "description": description,
        "tags": tags,
        "notes": notes,
        "is_private": is_private,
        "images": [],
    }

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for index, image in enumerate(images):
            archive_filename = f"{index:03d}_{image.original_filename}"
            archive.writestr(f"{_IMAGES_DIR}/{archive_filename}", image.data)
            manifest["images"].append(
                {
                    "filename": archive_filename, "role": image.role, "order_index": image.order_index,
                    "source": image.source, "width": image.width, "height": image.height,
                }
            )
        archive.writestr(_MANIFEST_NAME, json.dumps(manifest, ensure_ascii=False, indent=2))

    return buffer.getvalue()


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise CharacterPackError(message)


def parse_character_pack(zip_bytes: bytes) -> CharacterPack:
    """Valida e legge un Character Pack. Valida TUTTA la struttura (manifest + ogni
    immagine referenziata) prima di ritornare — un pack parzialmente valido non esiste:
    o è valido per intero, o `CharacterPackError` con un messaggio chiaro, mai un
    import parziale/indovinato."""
    try:
        archive = zipfile.ZipFile(BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise CharacterPackError("Il file non è un archivio ZIP valido.") from exc

    names = set(archive.namelist())
    _require(_MANIFEST_NAME in names, f"Manca '{_MANIFEST_NAME}' nell'archivio: non è un Character Pack.")

    try:
        manifest = json.loads(archive.read(_MANIFEST_NAME))
    except (ValueError, UnicodeDecodeError) as exc:
        raise CharacterPackError(f"'{_MANIFEST_NAME}' non è JSON valido.") from exc
    _require(isinstance(manifest, dict), f"'{_MANIFEST_NAME}' deve contenere un oggetto JSON.")

    _require(manifest.get("format") == _FORMAT, "Il file non è un Character Pack di Comfy Director.")
    format_version = manifest.get("format_version")
    _require(
        isinstance(format_version, int) and format_version <= _FORMAT_VERSION,
        f"Versione del formato Character Pack non supportata da questa build (trovata: {format_version!r}).",
    )

    name = manifest.get("name")
    _require(isinstance(name, str) and name.strip() != "", "Il personaggio nel pack non ha un nome valido.")

    description = manifest.get("description")
    _require(description is None or isinstance(description, str), "'description' deve essere testo o assente.")

    tags = manifest.get("tags", [])
    _require(isinstance(tags, list) and all(isinstance(t, str) for t in tags), "'tags' deve essere una lista di stringhe.")

    notes = manifest.get("notes")
    _require(notes is None or isinstance(notes, str), "'notes' deve essere testo o assente.")

    is_private = manifest.get("is_private", False)
    _require(isinstance(is_private, bool), "'is_private' deve essere un booleano.")

    raw_images = manifest.get("images", [])
    _require(isinstance(raw_images, list), "'images' deve essere una lista.")

    images: list[PackImage] = []
    for i, raw in enumerate(raw_images):
        _require(isinstance(raw, dict), f"L'immagine #{i} nel manifest non è un oggetto valido.")
        filename = raw.get("filename")
        _require(isinstance(filename, str) and filename, f"L'immagine #{i} non ha un 'filename' valido.")
        archive_path = f"{_IMAGES_DIR}/{filename}"
        _require(archive_path in names, f"Il manifest referenzia '{filename}' ma il file non è nell'archivio.")

        role = raw.get("role")
        _require(role in ("main", "reference"), f"L'immagine '{filename}' ha un 'role' non valido: {role!r}.")
        order_index = raw.get("order_index")
        _require(isinstance(order_index, int), f"L'immagine '{filename}' ha un 'order_index' non valido.")
        source = raw.get("source")
        _require(isinstance(source, str) and source, f"L'immagine '{filename}' non ha una 'source' valida.")
        width, height = raw.get("width"), raw.get("height")
        _require(width is None or isinstance(width, int), f"L'immagine '{filename}' ha una 'width' non valida.")
        _require(height is None or isinstance(height, int), f"L'immagine '{filename}' ha una 'height' non valida.")

        data = archive.read(archive_path)
        _require(len(data) > 0, f"Il file immagine '{filename}' nell'archivio è vuoto.")

        images.append(
            PackImage(filename=filename, role=role, order_index=order_index, source=source, width=width, height=height, data=data)
        )

    return CharacterPack(name=name, description=description, tags=tags, notes=notes, is_private=is_private, images=images)
