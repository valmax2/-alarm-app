"""Scansione diretta della cartella modelli di ComfyUI sul filesystem.

Fonte di inventario COMPLEMENTARE a `/object_info` (sync.py): funziona anche se
ComfyUI non è in esecuzione, e dà accesso a metadata reali (dimensione file, header
`.safetensors`) che `/object_info` da solo non fornisce. Richiede che il Bridge — cioè
il processo lanciato SUL PC dell'utente tramite `scripts/START_BRIDGE.bat` — possa
leggere quel percorso: in questa sessione di sviluppo cloud non esiste un percorso del
genere (vedi AUDIT.md), quindi questo modulo è validato con directory di fixture create
nei test, non con una vera installazione ComfyUI.

Struttura a sottocartelle assunta: quella standard di ComfyUI (`models/checkpoints`,
`models/loras`, ecc.) — un'assunzione ragionevole e documentata, non una certezza:
sottocartelle non riconosciute vengono ignorate silenziosamente (mai un errore per una
struttura non standard), e resta possibile arricchire la mappa in futuro.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

KNOWN_EXTENSIONS: frozenset[str] = frozenset({".safetensors", ".ckpt", ".pt", ".pth", ".bin", ".sft"})

# Nome sottocartella (dentro la cartella modelli) -> model_type. Più nomi possono
# mappare allo stesso tipo per coprire convenzioni diverse tra versioni ComfyUI (es.
# "clip" vs "text_encoders", "unet" vs "diffusion_models").
SUBFOLDER_TO_MODEL_TYPE: dict[str, str] = {
    "checkpoints": "checkpoint",
    "loras": "lora",
    "lora": "lora",
    "vae": "vae",
    "clip": "clip",
    "text_encoders": "clip",
    "clip_vision": "clip_vision",
    "controlnet": "controlnet",
    "upscale_models": "upscale",
    "embeddings": "embedding",
    "diffusion_models": "diffusion_model",
    "unet": "diffusion_model",
    "style_models": "other",
    "gligen": "other",
    "ipadapter": "ipadapter",
    "instantid": "instantid",
    "photomaker": "other",
}


@dataclass(frozen=True)
class ScannedModelFile:
    name: str
    path: str  # relativo alla cartella modelli, separatori '/'
    absolute_path: Path
    model_type: str
    extension: str
    size_bytes: int | None


def resolve_models_directory(root_path: Path) -> Path:
    """`root_path` può essere la cartella radice dell'installazione ComfyUI (contiene
    una sottocartella `models/`) oppure già la cartella modelli stessa (contiene
    direttamente `checkpoints/`, `loras/`, ...). Tollerante a entrambi i casi, così
    l'utente non deve indovinare quale livello incollare nelle Impostazioni."""
    candidate = root_path / "models"
    if candidate.is_dir():
        return candidate
    return root_path


def scan_models_directory(models_path: Path) -> list[ScannedModelFile]:
    results: list[ScannedModelFile] = []
    if not models_path.is_dir():
        return results

    for subfolder, model_type in SUBFOLDER_TO_MODEL_TYPE.items():
        subdir = models_path / subfolder
        if not subdir.is_dir():
            continue
        for file_path in sorted(subdir.rglob("*")):
            if not file_path.is_file():
                continue
            ext = file_path.suffix.lower()
            if ext not in KNOWN_EXTENSIONS:
                continue
            try:
                size = file_path.stat().st_size
            except OSError:
                size = None
            rel = file_path.relative_to(models_path)
            results.append(
                ScannedModelFile(
                    name=file_path.name,
                    path=str(rel).replace("\\", "/"),
                    absolute_path=file_path,
                    model_type=model_type,
                    extension=ext.lstrip("."),
                    size_bytes=size,
                )
            )
    return results
