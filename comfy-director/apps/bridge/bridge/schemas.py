"""Contratti API tipizzati (Pydantic) — spec §32.

Questi modelli sono la fonte da cui `packages/shared-types` deriva i tipi TypeScript
(via lo schema OpenAPI generato automaticamente da FastAPI su /openapi.json), per non
mantenere manualmente due copie dei contratti.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from bridge.workflow import GraphEdge, GraphNode


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


class ImportedNodeOut(BaseModel):
    id: str
    class_type: str
    title: str | None
    present_in_inventory: bool | None = Field(
        default=None,
        description="null = non verificabile (nessuna sincronizzazione inventario fatta finora).",
    )


class WorkflowImportResponse(BaseModel):
    found: bool
    source: Literal["workflow", "prompt"] | None
    node_count: int
    link_count: int
    nodes: list[ImportedNodeOut]
    missing_node_types: list[str]
    inventory_checked: bool
    message: str


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


class AIProviderCreateRequest(BaseModel):
    kind: Literal["anthropic", "openai", "local"]
    label: str
    api_key: str | None = Field(
        default=None, description="Richiesta per 'anthropic'/'openai'. Mai loggata, mai restituita in chiaro."
    )
    base_url: str | None = Field(
        default=None, description="Solo per endpoint OpenAI-compatibili non ufficiali."
    )
    default_model: str | None = None


class AIProviderOut(BaseModel):
    id: str
    kind: str
    label: str
    base_url: str | None
    default_model: str | None
    enabled: bool
    has_api_key: bool = Field(description="Mai la chiave in chiaro né mascherata: solo se è configurata.")
    created_at: datetime


class StructuredPromptOut(BaseModel):
    subject: str
    identity: str
    hair: str
    face: str
    body_clothing: str
    pose_action: str
    environment: str
    camera: str
    light: str
    style: str
    details: str
    final_prompt_en: str


class PromptFromImageResponse(BaseModel):
    provider_id: str
    provider_kind: str
    structured: StructuredPromptOut


class NodeSchemaOut(BaseModel):
    class_type: str
    display_name: str
    category: str
    is_custom_node: bool
    input_summary: list[dict[str, Any]]
    output_summary: list[dict[str, Any]]


class WorkflowGraphIn(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class ValidationIssueOut(BaseModel):
    severity: Literal["error", "warning"]
    node_id: str | None
    message: str


class WorkflowSummaryOut(BaseModel):
    id: str
    name: str
    intent: str | None
    family: str | None
    source: str
    node_count: int
    edge_count: int
    updated_at: datetime


class WorkflowDetailOut(BaseModel):
    id: str
    name: str
    intent: str | None
    family: str | None
    source: str
    version_number: int
    graph: WorkflowGraphIn
    validation_issues: list[ValidationIssueOut]
    updated_at: datetime


class WorkflowCreateRequest(BaseModel):
    name: str
    # Famiglia dichiarata dall'utente alla creazione (spec: "creo un nuovo flusso
    # scegliendo tra i vari WAN/Qwen/..."). Stringa libera perché KNOWN_FAMILIES
    # (bridge.inventory.family_detection) è esplicitamente un elenco non chiuso — la UI
    # propone quelle note più "altro", ma qui non forziamo un enum rigido.
    family: str | None = None


class WorkflowSaveRequest(BaseModel):
    graph: WorkflowGraphIn
    note: str | None = None


class WorkflowImportJsonRequest(BaseModel):
    name: str
    raw_json: str  # contenuto testuale del file .json così com'è, non ancora parsato


class WorkflowImportJsonResponse(BaseModel):
    workflow: WorkflowSummaryOut
    source: Literal["prompt", "workflow"]
    # Tipi di nodo per cui non è stato possibile assegnare i valori widget (schema non
    # nell'ultimo inventario sincronizzato) — dichiarato in UI, mai nascosto.
    unmapped_widget_node_types: list[str]


class GenerationOutputOut(BaseModel):
    filename: str
    subfolder: str
    type: str


class GenerationOut(BaseModel):
    id: str
    workflow_id: str | None
    workflow_version_id: str | None
    comfy_prompt_id: str | None
    status: Literal["queued", "running", "completed", "error", "aborted"]
    seed: int | None
    outputs: list[GenerationOutputOut]
    # Errori di validazione riportati DA COMFYUI STESSO (non dal Bridge) alla messa in
    # coda — mai interpretati, mostrati così come sono.
    node_errors: dict[str, Any] | None
    duration_ms: int | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
