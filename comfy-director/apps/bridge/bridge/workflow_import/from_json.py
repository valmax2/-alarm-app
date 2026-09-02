"""Import di un workflow ComfyUI da un file .json standalone (non da un'immagine — per
quello vedi `bridge.workflow_import.from_image`, Fase 8). Copre la richiesta esplicita
dell'utente: poter caricare direttamente un file `.json` esportato da ComfyUI e
ritrovarselo aperto e modificabile sulla canvas reale (Fase 3).

Due formati riconosciuti — gli stessi due che ComfyUI stesso esporta e che
`from_image.py` già gestisce per i metadata PNG:

1. Formato API ("Save (API Format)" in ComfyUI): `{node_id: {class_type, inputs:
   {nome: valore | [id_nodo_sorgente, indice_slot]}}}`. Non ambiguo per la STRUTTURA
   (ogni valore è o un letterale o un riferimento a un output altrui) — per i NOMI
   delle porte di output serve però lo schema del nodo sorgente (l'indice di slot da
   solo non basta per generare un handle stabile lato canvas); quando il tipo di nodo
   sorgente non è nell'ultimo inventario sincronizzato si ripiega sull'indice come
   stringa (mai un nome inventato) e il tipo viene segnalato in
   `unmapped_widget_node_types`.
2. Formato UI ("Save" normale): `{"nodes": [...], "links": [...]}`. Ogni nodo elenca
   già i propri `inputs`/`outputs` CON NOME — la struttura del grafo si ricostruisce
   sempre, senza bisogno dello schema. I valori dei widget invece sono in
   `widgets_values`, un array POSIZIONALE senza nomi: per assegnarli servono
   nome/ordine reali dei widget del tipo di nodo, ottenibili SOLO dall'ultimo
   inventario sincronizzato (stesso meccanismo con cui il frontend genera i widget in
   canvas, `bridge.inventory.sync.normalize_input_summary`). Se il tipo di nodo non è
   nell'inventario sincronizzato, i valori widget NON vengono assegnati — mai un
   valore inventato — il nodo viene comunque importato con posizione e collegamenti, e
   la validazione strutturale lo segnalerà comunque come "non presente nell'ultimo
   inventario sincronizzato" (bridge.workflow.validate_structure).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from bridge.workflow import GraphEdge, GraphNode, NodeSchemaInfo, WorkflowGraph

_WIDGET_SCALAR_TYPES = {"INT", "FLOAT", "STRING", "BOOLEAN"}

_GRID_COLS = 4
_GRID_COL_WIDTH = 240.0
_GRID_ROW_HEIGHT = 180.0


class WorkflowJsonImportError(Exception):
    """Il file non è riconoscibile come nessuno dei due formati ComfyUI noti, o non
    contiene alcun nodo importabile."""


@dataclass(frozen=True)
class JsonImportResult:
    graph: WorkflowGraph
    node_count: int
    edge_count: int
    source: str  # "prompt" | "workflow"
    # Tipi di nodo per cui NON è stato possibile assegnare i valori widget (formato
    # "workflow") o risolvere il nome di una porta di output (formato "prompt") perché
    # il tipo non è nell'ultimo inventario sincronizzato — dichiarato esplicitamente,
    # mai nascosto.
    unmapped_widget_node_types: list[str]


def _is_widget_input(entry: dict[str, Any]) -> bool:
    return entry.get("enum_values") is not None or entry.get("type") in _WIDGET_SCALAR_TYPES


def _grid_position(index: int) -> dict[str, float]:
    col, row = index % _GRID_COLS, index // _GRID_COLS
    return {"x": 120.0 + col * _GRID_COL_WIDTH, "y": 120.0 + row * _GRID_ROW_HEIGHT}


def _from_prompt_format(
    data: dict[str, Any], known_schemas: dict[str, NodeSchemaInfo]
) -> tuple[WorkflowGraph, list[str]]:
    class_type_by_id = {
        node_id: str(spec["class_type"])
        for node_id, spec in data.items()
        if isinstance(spec, dict) and "class_type" in spec
    }

    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    unmapped: set[str] = set()

    for index, (node_id, spec) in enumerate(data.items()):
        if not isinstance(spec, dict) or "class_type" not in spec:
            continue
        class_type = str(spec["class_type"])
        params: dict[str, Any] = {}
        inputs = spec.get("inputs")
        if isinstance(inputs, dict):
            for input_name, value in inputs.items():
                is_connection = (
                    isinstance(value, list) and len(value) == 2 and isinstance(value[1], int)
                )
                if not is_connection:
                    params[input_name] = value
                    continue
                source_id, source_slot = str(value[0]), value[1]
                source_class_type = class_type_by_id.get(source_id)
                source_schema = known_schemas.get(source_class_type) if source_class_type else None
                source_handle: str | None = None
                if source_schema is not None and 0 <= source_slot < len(source_schema.output_summary):
                    name = source_schema.output_summary[source_slot].get("name")
                    source_handle = str(name) if name is not None else None
                if source_handle is None:
                    if source_class_type:
                        unmapped.add(source_class_type)
                    source_handle = str(source_slot)
                edges.append(
                    GraphEdge(
                        id=f"import-{node_id}-{input_name}", source=source_id, source_handle=source_handle,
                        target=node_id, target_handle=input_name,
                    )
                )
        nodes.append(GraphNode(id=node_id, class_type=class_type, position=_grid_position(index), params=params))

    return WorkflowGraph(nodes=nodes, edges=edges), sorted(unmapped)


def _from_ui_workflow_format(
    data: dict[str, Any], known_schemas: dict[str, NodeSchemaInfo]
) -> tuple[WorkflowGraph, list[str]]:
    nodes_raw = data.get("nodes")
    if not isinstance(nodes_raw, list):
        raise WorkflowJsonImportError("Nessun elenco 'nodes' nel file: non sembra un workflow ComfyUI (formato UI).")

    node_by_id: dict[str, dict[str, Any]] = {
        str(n["id"]): n for n in nodes_raw if isinstance(n, dict) and "id" in n
    }
    class_type_by_id: dict[str, str] = {
        node_id: str(n.get("type", "?")) for node_id, n in node_by_id.items()
    }

    graph_nodes: list[GraphNode] = []
    unmapped: set[str] = set()
    for index, n in enumerate(nodes_raw):
        if not isinstance(n, dict) or "id" not in n:
            continue
        node_id = str(n["id"])
        class_type = str(n.get("type", "?"))
        pos = n.get("pos")
        if isinstance(pos, list) and len(pos) >= 2:
            position = {"x": float(pos[0]), "y": float(pos[1])}
        else:
            position = _grid_position(index)

        params: dict[str, Any] = {}
        widgets_values = n.get("widgets_values")
        if isinstance(widgets_values, list) and widgets_values:
            schema = known_schemas.get(class_type)
            if schema is None:
                unmapped.add(class_type)
            else:
                widget_names = [i.get("name") for i in schema.input_summary if _is_widget_input(i)]
                for name, value in zip(widget_names, widgets_values, strict=False):
                    if name is not None:
                        params[name] = value

        graph_nodes.append(GraphNode(id=node_id, class_type=class_type, position=position, params=params))

    graph_edges: list[GraphEdge] = []
    links_raw = data.get("links")
    if isinstance(links_raw, list):
        for link in links_raw:
            if not isinstance(link, list) or len(link) < 5:
                continue
            link_id, origin_id, origin_slot, target_id, target_slot = link[:5]
            origin_node = node_by_id.get(str(origin_id))
            target_node = node_by_id.get(str(target_id))
            if origin_node is None or target_node is None:
                continue

            source_handle = _port_name_at(origin_node.get("outputs"), origin_slot)
            if source_handle is None:
                # Alcuni file omettono `outputs` per nodo (es. versioni ComfyUI più
                # vecchie): ripiego sullo schema sincronizzato, se disponibile, prima di
                # arrendermi — mai un nome inventato, solo una fonte alternativa reale.
                schema = known_schemas.get(class_type_by_id.get(str(origin_id), ""))
                if schema is not None and isinstance(origin_slot, int) and 0 <= origin_slot < len(schema.output_summary):
                    name = schema.output_summary[origin_slot].get("name")
                    source_handle = str(name) if name is not None else None
                if source_handle is None:
                    unmapped.add(class_type_by_id.get(str(origin_id), "?"))

            target_handle = _port_name_at(target_node.get("inputs"), target_slot)
            if source_handle is None or target_handle is None:
                continue
            graph_edges.append(
                GraphEdge(
                    id=f"import-link-{link_id}", source=str(origin_id), source_handle=source_handle,
                    target=str(target_id), target_handle=target_handle,
                )
            )

    return WorkflowGraph(nodes=graph_nodes, edges=graph_edges), sorted(unmapped)


def _port_name_at(ports: Any, slot: Any) -> str | None:
    if not isinstance(ports, list) or not isinstance(slot, int) or not (0 <= slot < len(ports)):
        return None
    port = ports[slot]
    if not isinstance(port, dict):
        return None
    name = port.get("name")
    return str(name) if name is not None else None


def _looks_like_prompt_format(data: dict[str, Any]) -> bool:
    return bool(data) and all(isinstance(v, dict) and "class_type" in v for v in data.values())


def import_workflow_json(raw: dict[str, Any] | str, known_schemas: dict[str, NodeSchemaInfo]) -> JsonImportResult:
    """Punto d'ingresso: riconosce il formato e ricostruisce un `WorkflowGraph` reale
    (mai un riassunto di sola lettura come `from_image.extract_workflow_from_image` —
    qui il grafo deve essere subito apribile e modificabile in canvas)."""
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise WorkflowJsonImportError(f"JSON non valido: {exc}") from exc
    else:
        parsed = raw

    if not isinstance(parsed, dict):
        raise WorkflowJsonImportError("Il file non contiene un oggetto JSON al livello superiore.")

    if isinstance(parsed.get("nodes"), list):
        graph, unmapped = _from_ui_workflow_format(parsed, known_schemas)
        source = "workflow"
    elif _looks_like_prompt_format(parsed):
        graph, unmapped = _from_prompt_format(parsed, known_schemas)
        source = "prompt"
    else:
        raise WorkflowJsonImportError(
            "Formato non riconosciuto: non è né un workflow ComfyUI esportato con 'Save' "
            "(un oggetto con 'nodes'/'links') né uno esportato con 'Save (API Format)' "
            "(una mappa id-nodo → {class_type, inputs})."
        )

    if not graph.nodes:
        raise WorkflowJsonImportError("Nessun nodo trovato nel file.")

    return JsonImportResult(
        graph=graph, node_count=len(graph.nodes), edge_count=len(graph.edges),
        source=source, unmapped_widget_node_types=unmapped,
    )
