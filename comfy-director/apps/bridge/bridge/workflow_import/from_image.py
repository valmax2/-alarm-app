"""Workflow da Immagine (spec §8).

Legge i metadata PNG incorporati da ComfyUI (`bridge.media.png_metadata`) e, se
presenti, ricostruisce un riassunto del grafo — MAI un finto workflow quando i
metadata non ci sono (spec §8: "Non fingere di poter ricostruire esattamente un
workflow che non è presente").

Due formati possibili, in ordine di preferenza:
1. `workflow` (formato UI, con `nodes`/`links`/posizioni) — più ricco, riusabile in
   Fase 3 per aprire il grafo sulla canvas reale.
2. `prompt` (formato API, `{node_id: {class_type, inputs}}`) — meno ricco (nessuna
   posizione/layout), ma comunque un elenco nodi reale.

Se un elenco di `class_type` realmente installati (dall'ultima sync, Fase 2) è
disponibile, ogni nodo importato viene marcato presente/assente — mai un'affermazione
di "componente mancante" quando non sappiamo cosa sia installato (`present_in_inventory
= None` in quel caso, distinto esplicitamente da `False`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

from bridge.media.png_metadata import PngParseError, read_png_text_chunks

_NOT_FOUND_MESSAGE = "Workflow ComfyUI non trovato nei metadata. Vuoi analizzare l'immagine per ricavarne un prompt?"


@dataclass(frozen=True)
class ImportedNodeSummary:
    id: str
    class_type: str
    title: str | None
    present_in_inventory: bool | None  # None = non verificabile (nessuna sync fatta finora)


@dataclass(frozen=True)
class WorkflowImportResult:
    found: bool
    source: Literal["workflow", "prompt"] | None
    node_count: int
    link_count: int
    nodes: list[ImportedNodeSummary]
    missing_node_types: list[str]
    inventory_checked: bool
    raw_graph: dict | None
    message: str


def _not_found(inventory_checked: bool, message: str = _NOT_FOUND_MESSAGE) -> WorkflowImportResult:
    return WorkflowImportResult(
        found=False, source=None, node_count=0, link_count=0, nodes=[], missing_node_types=[],
        inventory_checked=inventory_checked, raw_graph=None, message=message,
    )


def _summarize_ui_workflow(graph: dict, known_class_types: set[str] | None) -> WorkflowImportResult:
    nodes_raw = graph.get("nodes")
    links_raw = graph.get("links")
    if not isinstance(nodes_raw, list):
        return _not_found(known_class_types is not None)

    nodes: list[ImportedNodeSummary] = []
    missing: set[str] = set()
    for n in nodes_raw:
        if not isinstance(n, dict):
            continue
        class_type = str(n.get("type", "?"))
        present = None
        if known_class_types is not None:
            present = class_type in known_class_types
            if not present:
                missing.add(class_type)
        nodes.append(
            ImportedNodeSummary(
                id=str(n.get("id", "?")), class_type=class_type, title=n.get("title"),
                present_in_inventory=present,
            )
        )

    link_count = len(links_raw) if isinstance(links_raw, list) else 0
    missing_note = f" {len(missing)} tipi di nodo non risultano installati." if missing else ""
    return WorkflowImportResult(
        found=True, source="workflow", node_count=len(nodes), link_count=link_count, nodes=nodes,
        missing_node_types=sorted(missing), inventory_checked=known_class_types is not None,
        raw_graph=graph, message=f"Workflow trovato: {len(nodes)} nodi, {link_count} collegamenti.{missing_note}",
    )


def _summarize_api_prompt(graph: dict, known_class_types: set[str] | None) -> WorkflowImportResult:
    nodes: list[ImportedNodeSummary] = []
    missing: set[str] = set()
    for node_id, spec in graph.items():
        if not isinstance(spec, dict):
            continue
        class_type = str(spec.get("class_type", "?"))
        present = None
        if known_class_types is not None:
            present = class_type in known_class_types
            if not present:
                missing.add(class_type)
        nodes.append(
            ImportedNodeSummary(id=str(node_id), class_type=class_type, title=None, present_in_inventory=present)
        )

    if not nodes:
        return _not_found(known_class_types is not None)

    missing_note = f" {len(missing)} tipi di nodo non risultano installati." if missing else ""
    return WorkflowImportResult(
        found=True, source="prompt", node_count=len(nodes), link_count=0, nodes=nodes,
        missing_node_types=sorted(missing), inventory_checked=known_class_types is not None,
        raw_graph=graph,
        message=(
            f"Workflow trovato in formato API (senza layout/posizioni): {len(nodes)} nodi."
            f"{missing_note}"
        ),
    )


def extract_workflow_from_image(image_bytes: bytes, known_class_types: set[str] | None = None) -> WorkflowImportResult:
    """`known_class_types`: i `class_type` realmente presenti nell'ultima sync
    dell'inventario (Fase 2) — se `None`, nessuna sync è mai stata fatta e i nodi
    importati non possono essere marcati presenti/assenti (dichiarato con
    `inventory_checked=False`, mai un falso "tutto ok")."""
    try:
        chunks = read_png_text_chunks(image_bytes)
    except PngParseError as exc:
        return _not_found(
            known_class_types is not None,
            message=f"Immagine non leggibile come PNG con metadata ComfyUI: {exc}",
        )

    workflow_raw = chunks.get("workflow")
    if workflow_raw:
        try:
            graph = json.loads(workflow_raw)
        except json.JSONDecodeError:
            graph = None
        if isinstance(graph, dict):
            result = _summarize_ui_workflow(graph, known_class_types)
            if result.found:
                return result

    prompt_raw = chunks.get("prompt")
    if prompt_raw:
        try:
            graph = json.loads(prompt_raw)
        except json.JSONDecodeError:
            graph = None
        if isinstance(graph, dict):
            result = _summarize_api_prompt(graph, known_class_types)
            if result.found:
                return result

    return _not_found(known_class_types is not None)
