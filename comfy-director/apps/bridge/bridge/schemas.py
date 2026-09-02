"""Contratti API tipizzati (Pydantic) — spec §32.

Questi modelli sono la fonte da cui `packages/shared-types` deriva i tipi TypeScript
(via lo schema OpenAPI generato automaticamente da FastAPI su /openapi.json), per non
mantenere manualmente due copie dei contratti.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    time: datetime


class ComfyStatusResponse(BaseModel):
    status: Literal["online", "offline"]
    reason: str | None = Field(
        default=None,
        description="Motivo leggibile quando status='offline' (es. 'non raggiungibile', 'timeout').",
    )
    base_url: str
    version: str | None = None
    os: str | None = None
    python_version: str | None = None
    pytorch_version: str | None = None
    checked_at: datetime


class SettingsResponse(BaseModel):
    comfy_base_url: str
    comfy_root_path: str | None = Field(
        default=None,
        description=(
            "Percorso locale dell'installazione ComfyUI (o direttamente della sua "
            "cartella 'models'), impostato dall'utente quando lancia il Bridge sul "
            "proprio PC. Se assente, l'inventario modelli si basa solo su /object_info "
            "(nessuna scansione filesystem, nessun hash/header)."
        ),
    )


class SettingsUpdateRequest(BaseModel):
    comfy_base_url: str
    comfy_root_path: str | None = None


class SyncResponse(BaseModel):
    comfy_status: Literal["online", "offline"]
    comfy_version: str | None = None
    node_count: int
    custom_node_count: int
    model_count: int
    model_counts_by_type: dict[str, int]
    filesystem_scan_used: bool
    synced_at: datetime


class NodeOut(BaseModel):
    class_type: str
    display_name: str
    category: str
    is_custom_node: bool
    last_seen: datetime


class ModelOut(BaseModel):
    id: str
    name: str
    path: str
    model_type: str
    extension: str
    size_bytes: int | None
    family: str | None
    detection_confidence: float
    detection_source: str
    last_seen: datetime
    # Popolati solo quando la richiesta specifica una famiglia target (contesto
    # "TIPO WORKFLOW + FAMIGLIA", spec §5/§14) — valutati dal Compatibility Engine,
    # mai un semplice confronto di stringhe nascosto all'utente.
    compatibility: Literal["compatible", "incompatible", "unknown", "warning"] | None = None
    compatibility_reason: str | None = None
