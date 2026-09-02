"""Storage filesystem per le immagini dei personaggi (Fase 7).

docs/module-boundaries.md: "CRUD personaggi + gestione immagini su filesystem
(`data/storage/characters/...`), mai logica di compatibilità o di rete qui dentro."

Path sempre RELATIVI a `Settings.storage_dir`, persistiti così in DB
(`CharacterImageRecord.storage_path`) — mai un path assoluto dipendente dalla
macchina, mai i byte dell'immagine (o una loro codifica base64) in DB.
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

_EXTENSION_BY_CONTENT_TYPE = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_ALLOWED_EXTENSIONS = set(_EXTENSION_BY_CONTENT_TYPE.values())


def guess_extension(filename: str | None, content_type: str | None) -> str:
    """Preferisce l'estensione del filename originale se è tra quelle note; altrimenti
    ripiega sul content-type dichiarato; se nessuno dei due è utile, `.bin` — mai
    un'estensione indovinata senza indizio reale."""
    if filename:
        suffix = Path(filename).suffix.lower()
        if suffix in _ALLOWED_EXTENSIONS:
            return suffix
    if content_type in _EXTENSION_BY_CONTENT_TYPE:
        return _EXTENSION_BY_CONTENT_TYPE[content_type]
    return ".bin"


def character_dir(storage_root: Path, character_id: str) -> Path:
    return storage_root / "characters" / character_id


def save_character_image(
    storage_root: Path, character_id: str, data: bytes, filename: str | None, content_type: str | None,
) -> str:
    """Salva i byte su disco sotto una cartella dedicata al personaggio, con un nome
    file generato (mai il nome originale, per evitare collisioni/path traversal) —
    ritorna il path RELATIVO a `storage_root` da persistere in DB."""
    ext = guess_extension(filename, content_type)
    directory = character_dir(storage_root, character_id)
    directory.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    (directory / unique_name).write_bytes(data)
    return f"characters/{character_id}/{unique_name}"


def delete_character_image(storage_root: Path, relative_path: str) -> None:
    """Elimina un singolo file — tollerante se già assente (mai un errore per uno
    stato che l'utente non può osservare come problematico)."""
    path = storage_root / relative_path
    if path.exists():
        path.unlink()


def delete_character_directory(storage_root: Path, character_id: str) -> None:
    """Elimina l'intera cartella di un personaggio (chiamata quando il personaggio
    stesso viene eliminato) — mai file orfani lasciati sul disco."""
    directory = character_dir(storage_root, character_id)
    if directory.exists():
        shutil.rmtree(directory)
