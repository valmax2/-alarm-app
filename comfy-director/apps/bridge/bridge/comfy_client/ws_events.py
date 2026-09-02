"""Parsing dei messaggi del canale WebSocket di ComfyUI (`/ws?clientId=...`), Fase 6 v2
(spec §18).

Puramente sintattico: nessuna dipendenza dal Bridge (modelli, DB, ...) — riusabile e
testabile in isolamento (`tests/test_ws_events.py`). Non solleva mai un'eccezione su un
messaggio inatteso o malformato: un singolo messaggio non riconosciuto non deve mai
interrompere la relay persistente (coerente con "nessuna assunzione di versione
ComfyUI", docs/comfyui-api.md).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal

ComfyWSEventType = Literal[
    "status", "progress", "executing", "execution_error", "execution_cached", "unknown"
]

_KNOWN_TYPES: frozenset[str] = frozenset(
    {"status", "progress", "executing", "execution_error", "execution_cached"}
)


@dataclass(frozen=True)
class ComfyWSEvent:
    """Vista normalizzata di un messaggio `/ws` di ComfyUI. `prompt_id`/`node_id`
    restano `None` quando il messaggio non li porta (es. `status`, che riguarda la
    coda intera, non un prompt specifico) — mai un valore indovinato."""

    type: ComfyWSEventType
    prompt_id: str | None
    node_id: str | None
    progress_value: int | None
    progress_max: int | None
    raw: dict[str, Any]


def parse_comfy_ws_message(raw_text: str) -> ComfyWSEvent | None:
    """Converte un messaggio testuale grezzo di `/ws` in un `ComfyWSEvent`.

    Ritorna `None` per testo non-JSON, JSON non-oggetto, o senza `type` — ComfyUI invia
    anche frame binari (preview immagine durante il sampling) su questo stesso canale:
    quelli non passano nemmeno da qui (filtrati a monte in `ComfyWSRelay`, che li
    ignora prima di chiamare questa funzione). Fase 6 v2 non implementa la live-preview
    delle immagini, solo nodo-in-esecuzione e percentuale di avanzamento — deferito
    esplicitamente.
    """
    try:
        parsed = json.loads(raw_text)
    except (ValueError, TypeError):
        return None
    if not isinstance(parsed, dict):
        return None

    msg_type = parsed.get("type")
    if not isinstance(msg_type, str):
        return None
    data = parsed.get("data") if isinstance(parsed.get("data"), dict) else {}

    event_type: ComfyWSEventType = msg_type if msg_type in _KNOWN_TYPES else "unknown"
    prompt_id = data.get("prompt_id")
    node_id = data.get("node")
    progress_value = data.get("value")
    progress_max = data.get("max")

    return ComfyWSEvent(
        type=event_type,
        prompt_id=str(prompt_id) if prompt_id is not None else None,
        node_id=str(node_id) if node_id is not None else None,
        progress_value=progress_value if isinstance(progress_value, int) else None,
        progress_max=progress_max if isinstance(progress_max, int) else None,
        raw=parsed,
    )
