"""Orchestrazione della sincronizzazione inventario (Fase 2).

Due fonti, complementari e INDIPENDENTI (spec §5: "la compatibilità/l'inventario
devono poter essere determinati attraverso più fonti") — una sync riesce se ALMENO UNA
delle due produce dati, non richiede entrambe:

1. `/object_info` (via ComfyClient) — tentata se ComfyUI è raggiungibile: dice quali
   file ComfyUI STESSO riconosce come utilizzabili dai suoi loader noti
   (node_registry.py), e fornisce l'elenco nodi/schema. Funziona anche se il Bridge
   gira su una macchina diversa da ComfyUI, ma non dà accesso a hash/header.
2. Scansione filesystem diretta (filesystem_scanner.py) — se l'utente ha configurato
   un percorso ComfyUI (`ComfyInstanceRecord.root_path`) leggibile dal processo
   Bridge. Funziona ANCHE SE ComfyUI non è in esecuzione (caso d'uso esplicito: "dammi
   un inventario di quello che ho sul disco" senza dover prima avviare ComfyUI) e dà
   dimensione reale e, per i `.safetensors`, family detection basata sull'header
   (fonte `metadata`, confidenza più alta della sola euristica sul nome).

La sync fallisce (eccezione propagata) SOLO se NESSUNA delle due fonti produce nulla —
mai un report parziale spacciato per completo, ma anche mai un fallimento totale
quando una fonte valida è disponibile (spec §3: "Non inventare numeri", ma anche "non
perdere il lavoro dell'utente" per un ComfyUI temporaneamente spento, §34).

Nessun altro modulo scrive `nodes`, `node_schemas`, `models` (docs/module-boundaries.md).
Non decide compatibilità (quello è `bridge.compatibility`): registra fatti osservati più
un'ipotesi di famiglia con la propria confidenza dichiarata — mai una certezza finta.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from bridge.comfy_client import (
    ComfyClient,
    ComfyClientError,
)
from bridge.comfy_instance import get_or_create_default_instance
from bridge.inventory.family_detection import detect_family
from bridge.inventory.filesystem_scanner import resolve_models_directory, scan_models_directory
from bridge.inventory.node_registry import KNOWN_MODEL_LOADER_PARAMS
from bridge.inventory.safetensors_header import SafetensorsHeaderError, read_safetensors_header
from bridge.models import ModelRecord, NodeRecord, NodeSchemaRecord

DEFAULT_INSTANCE_ID = "default"

# Nodi "core" noti di ComfyUI: elenco indicativo e versionato, usato SOLO come segnale
# per `is_custom_node` (un nodo non in questo elenco è trattato come probabile custom
# node) — mai come verità assoluta, e mai usato per filtrare/nascondere nodi.
CORE_NODE_CLASSES: frozenset[str] = frozenset(
    {
        "CheckpointLoaderSimple", "CheckpointLoader", "unCLIPCheckpointLoader",
        "LoraLoader", "LoraLoaderModelOnly", "VAELoader", "VAEEncode", "VAEDecode",
        "ControlNetLoader", "ControlNetApply", "ControlNetApplyAdvanced", "DiffControlNetLoader",
        "CLIPLoader", "DualCLIPLoader", "CLIPTextEncode", "CLIPVisionLoader", "CLIPVisionEncode",
        "UNETLoader", "UpscaleModelLoader", "ImageUpscaleWithModel",
        "KSampler", "KSamplerAdvanced", "EmptyLatentImage", "LatentUpscale",
        "SaveImage", "PreviewImage", "LoadImage", "LoadImageMask",
        "ConditioningCombine", "ConditioningSetArea", "StyleModelLoader", "GLIGENLoader",
    }
)


def normalize_input_summary(raw_input: dict) -> list[dict]:
    """Vista piatta e stabile dello schema input grezzo di /object_info: usata sia per
    estrarre le liste enum dei loader (qui), sia — da Fase 3 — per generare i widget
    dinamici del pannello proprietà. Tollerante: campi mancanti/malformati vengono
    ignorati invece di far fallire l'intera sync (nessuna assunzione di versione,
    docs/comfyui-api.md)."""
    summary: list[dict] = []
    for kind in ("required", "optional"):
        section = raw_input.get(kind)
        if not isinstance(section, dict):
            continue
        for param_name, spec in section.items():
            if not isinstance(spec, list) or len(spec) == 0:
                continue
            type_or_enum = spec[0]
            opts = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
            is_enum = isinstance(type_or_enum, list)
            summary.append(
                {
                    "name": param_name,
                    "kind": kind,
                    "enum_values": type_or_enum if is_enum else None,
                    "type": None if is_enum else type_or_enum,
                    "default": opts.get("default"),
                    "min": opts.get("min"),
                    "max": opts.get("max"),
                    "step": opts.get("step"),
                }
            )
    return summary


def normalize_output_summary(schema: dict) -> list[dict]:
    """`name` è sempre valorizzato (mai `None`): quando ComfyUI non fornisce
    `output_name` per una porta, si ripiega su `output_{indice}` — serve un
    identificatore di porta stabile per gli handle degli archi sulla canvas (Fase 3)
    e per la validazione strutturale, che devono poter contare su una chiave sempre
    presente."""
    outputs = schema.get("output")
    names = schema.get("output_name")
    if not isinstance(outputs, list):
        return []
    result = []
    for i, out_type in enumerate(outputs):
        raw_name = names[i] if isinstance(names, list) and i < len(names) else None
        name = raw_name if isinstance(raw_name, str) and raw_name else f"output_{i}"
        result.append({"type": out_type, "name": name})
    return result


@dataclass
class SyncReport:
    comfy_status: str  # "online" | "offline" — offline è comunque un successo se la scansione filesystem ha prodotto dati
    comfy_version: str | None
    node_count: int
    custom_node_count: int
    model_counts_by_type: dict[str, int] = field(default_factory=dict)
    filesystem_scan_used: bool = False
    synced_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def model_count(self) -> int:
        return sum(self.model_counts_by_type.values())


def _upsert_model(
    *, model_id: str, name: str, path: str, model_type: str, extension: str,
    size_bytes: int | None, family: str | None, confidence: float, source: str, now: datetime,
    existing: ModelRecord | None,
) -> ModelRecord:
    if existing is None:
        return ModelRecord(
            id=model_id, comfy_instance_id=DEFAULT_INSTANCE_ID, name=name, path=path, model_type=model_type,
            extension=extension, size_bytes=size_bytes, family=family, detection_confidence=confidence,
            detection_source=source, last_seen=now,
        )
    existing.path = path
    existing.last_seen = now
    if size_bytes is not None:
        existing.size_bytes = size_bytes
    # Non declassare mai una detection più affidabile già registrata con una più debole.
    if confidence >= existing.detection_confidence:
        existing.family = family
        existing.detection_confidence = confidence
        existing.detection_source = source
    return existing


class NothingToSyncError(Exception):
    """Sollevata quando né ComfyUI è raggiungibile né un percorso filesystem valido è
    configurato: non c'è nessuna fonte da cui sincronizzare (spec §3: mai un report
    inventato)."""

    def __init__(self, comfy_error: Exception):
        self.comfy_error = comfy_error
        super().__init__(str(comfy_error))


async def sync_inventory(session: AsyncSession, client: ComfyClient, base_url: str) -> SyncReport:
    """Sincronizza nodi e modelli. Riesce se ALMENO UNA fonte produce dati (ComfyUI
    raggiungibile, o un percorso filesystem valido configurato) — vedi docstring del
    modulo. Solleva `NothingToSyncError` solo se nessuna delle due funziona.
    """
    now = datetime.now(UTC)
    instance = await get_or_create_default_instance(session, base_url)
    instance.base_url = base_url

    node_count = 0
    custom_node_count = 0
    touched_model_keys: set[str] = set()
    model_counts: dict[str, int] = {}

    def _touch(model_type: str, filename: str) -> str:
        key = f"{model_type}:{filename}"
        if key not in touched_model_keys:
            touched_model_keys.add(key)
            model_counts[model_type] = model_counts.get(model_type, 0) + 1
        return f"{DEFAULT_INSTANCE_ID}:{key}"

    comfy_reachable = False
    comfy_version: str | None = None
    comfy_error: Exception | None = None

    try:
        stats = await client.get_system_stats()
        object_info = await client.get_object_info()
    except ComfyClientError as exc:
        comfy_error = exc
        instance.last_status = "offline"
    else:
        comfy_reachable = True
        comfy_version = stats.version
        instance.last_status = "online"
        instance.last_version = stats.version

        for class_type, schema in object_info.items():
            if not isinstance(schema, dict):
                continue
            node_count += 1
            is_custom = class_type not in CORE_NODE_CLASSES
            if is_custom:
                custom_node_count += 1

            node_id = f"{DEFAULT_INSTANCE_ID}:{class_type}"
            node = await session.get(NodeRecord, node_id)
            display_name = schema.get("display_name") or class_type
            category = schema.get("category") or ""
            if node is None:
                node = NodeRecord(
                    id=node_id, comfy_instance_id=DEFAULT_INSTANCE_ID, class_type=class_type,
                    display_name=display_name, category=category, is_custom_node=is_custom, last_seen=now,
                )
                session.add(node)
            else:
                node.display_name = display_name
                node.category = category
                node.is_custom_node = is_custom
                node.last_seen = now

            raw_input = schema.get("input") if isinstance(schema.get("input"), dict) else {}
            input_summary = normalize_input_summary(raw_input)
            output_summary = normalize_output_summary(schema)

            node_schema = await session.get(NodeSchemaRecord, node_id)
            if node_schema is None:
                session.add(
                    NodeSchemaRecord(
                        node_id=node_id, raw_schema=json.dumps(schema),
                        input_summary=json.dumps(input_summary), output_summary=json.dumps(output_summary),
                        fetched_at=now,
                    )
                )
            else:
                node_schema.raw_schema = json.dumps(schema)
                node_schema.input_summary = json.dumps(input_summary)
                node_schema.output_summary = json.dumps(output_summary)
                node_schema.fetched_at = now

            param_map = KNOWN_MODEL_LOADER_PARAMS.get(class_type)
            if not param_map:
                continue
            for param_name, model_type in param_map:
                entry = next((e for e in input_summary if e["name"] == param_name), None)
                if entry is None or not entry["enum_values"]:
                    continue
                for filename in entry["enum_values"]:
                    if not isinstance(filename, str) or not filename:
                        continue
                    if f"{model_type}:{filename}" in touched_model_keys:
                        continue
                    model_id = _touch(model_type, filename)
                    # Solo euristica sul nome file qui — l'header reale (se
                    # disponibile) viene applicato dalla scansione filesystem qui
                    # sotto, che non declassa mai una confidenza già più alta.
                    guess = detect_family(filename, header=None)
                    extension = filename.rsplit(".", 1)[-1] if "." in filename else ""
                    existing = await session.get(ModelRecord, model_id)
                    record = _upsert_model(
                        model_id=model_id, name=filename, path=filename, model_type=model_type,
                        extension=extension, size_bytes=None, family=guess.family,
                        confidence=guess.confidence, source=guess.source, now=now, existing=existing,
                    )
                    if existing is None:
                        session.add(record)

    filesystem_scan_used = False
    if instance.root_path:
        models_dir = resolve_models_directory(Path(instance.root_path))
        scanned_files = scan_models_directory(models_dir)
        if scanned_files:
            filesystem_scan_used = True
        for scanned in scanned_files:
            header: dict | None = None
            if scanned.extension == "safetensors":
                try:
                    header = read_safetensors_header(scanned.absolute_path)
                except SafetensorsHeaderError:
                    header = None  # file illeggibile/corrotto: non blocca la sync, resta l'euristica sul nome

            guess = detect_family(scanned.name, header=header)
            model_id = _touch(scanned.model_type, scanned.name)
            existing = await session.get(ModelRecord, model_id)
            record = _upsert_model(
                model_id=model_id, name=scanned.name, path=scanned.path, model_type=scanned.model_type,
                extension=scanned.extension, size_bytes=scanned.size_bytes, family=guess.family,
                confidence=guess.confidence, source=guess.source, now=now, existing=existing,
            )
            if existing is None:
                session.add(record)

    instance.last_sync_at = now

    if not comfy_reachable and not filesystem_scan_used:
        # Né ComfyUI raggiungibile né una scansione filesystem valida: nessuna fonte
        # da cui sincronizzare. Non salviamo nulla di parziale/inventato.
        assert comfy_error is not None
        raise NothingToSyncError(comfy_error)

    await session.flush()

    return SyncReport(
        comfy_status="online" if comfy_reachable else "offline",
        comfy_version=comfy_version,
        node_count=node_count,
        custom_node_count=custom_node_count,
        model_counts_by_type=model_counts,
        filesystem_scan_used=filesystem_scan_used,
        synced_at=now,
    )
