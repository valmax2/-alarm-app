"""Modello interno del workflow (Fase 3, spec §10).

Il grafo VIVE nel frontend (store Zustand — unica source of truth mentre l'utente
edita, docs/module-boundaries.md) e viene serializzato qui per persistenza e
validazione strutturale. La forma JSON rispecchia deliberatamente `Node[]`/`Edge[]` di
React Flow (id/position/data lato nodi; source/target/sourceHandle/targetHandle lato
archi) per minimizzare la traduzione tra i due lati.

`add_node`/`remove_node`/`connect` (previsti in docs/module-boundaries.md per l'AI Tool
Layer) non sono ancora implementati qui: in Fase 3 le mutazioni del grafo avvengono
tutte lato frontend; arriveranno in Fase 10 quando l'AI Assistant dovrà proporle come
transazioni — aggiungerli ora senza un chiamante reale violerebbe la regola "non
fingere funzionalità implementate".
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str
    class_type: str
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    params: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    source: str
    source_handle: str
    target: str
    target_handle: str


class WorkflowGraph(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class StructuralIssue(BaseModel):
    severity: Literal["error", "warning"]
    node_id: str | None
    message: str


class NodeSchemaInfo(BaseModel):
    """Vista minima dello schema di un nodo, così come normalizzato dalla sync
    (bridge.inventory.sync.normalize_input_summary/normalize_output_summary) — usata
    qui solo per validare, non per rigenerarla."""

    input_summary: list[dict[str, Any]]
    output_summary: list[dict[str, Any]]


def validate_structure(graph: WorkflowGraph, node_schemas: dict[str, NodeSchemaInfo]) -> list[StructuralIssue]:
    """Valida SOLO la struttura (non la compatibilità semantica, quella è
    `bridge.compatibility` — spec §26): riferimenti ad archi/nodi inesistenti, cicli,
    input required non collegati né valorizzati, tipi di porta incompatibili sugli
    archi. Un nodo non presente nell'ultimo inventario sincronizzato produce un
    `warning` (potrebbe essere stato installato dopo l'ultima sync), mai un errore
    bloccante basato su un'assunzione.
    """
    issues: list[StructuralIssue] = []
    node_by_id = {n.id: n for n in graph.nodes}

    # 1. archi che referenziano nodi inesistenti
    valid_edges: list[GraphEdge] = []
    for edge in graph.edges:
        if edge.source not in node_by_id or edge.target not in node_by_id:
            issues.append(
                StructuralIssue(severity="error", node_id=None, message=f"Arco '{edge.id}' referenzia un nodo inesistente")
            )
            continue
        valid_edges.append(edge)

    # 2. cicli (DFS con recursion stack)
    adjacency: dict[str, list[str]] = {n.id: [] for n in graph.nodes}
    for edge in valid_edges:
        adjacency[edge.source].append(edge.target)

    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n.id: WHITE for n in graph.nodes}
    cyclic_nodes: set[str] = set()

    def _visit(node_id: str, stack: list[str]) -> None:
        color[node_id] = GRAY
        stack.append(node_id)
        for neighbor in adjacency[node_id]:
            if color[neighbor] == GRAY:
                cyclic_nodes.update(stack[stack.index(neighbor) :])
            elif color[neighbor] == WHITE:
                _visit(neighbor, stack)
        stack.pop()
        color[node_id] = BLACK

    for n in graph.nodes:
        if color[n.id] == WHITE:
            _visit(n.id, [])
    for node_id in sorted(cyclic_nodes):
        issues.append(StructuralIssue(severity="error", node_id=node_id, message="Il nodo fa parte di un ciclo nel grafo"))

    # 3. input required non collegati né valorizzati + nodi non nell'inventario sincronizzato
    connected_inputs: dict[str, set[str]] = {n.id: set() for n in graph.nodes}
    for edge in valid_edges:
        connected_inputs[edge.target].add(edge.target_handle)

    for node in graph.nodes:
        schema = node_schemas.get(node.class_type)
        if schema is None:
            issues.append(
                StructuralIssue(
                    severity="warning", node_id=node.id,
                    message=f"Nodo '{node.class_type}' non presente nell'ultimo inventario sincronizzato — non verificabile",
                )
            )
            continue
        for inp in schema.input_summary:
            if inp.get("kind") != "required":
                continue
            name = inp.get("name")
            has_value = name in node.params and node.params[name] is not None
            if name not in connected_inputs[node.id] and not has_value:
                issues.append(
                    StructuralIssue(
                        severity="error", node_id=node.id,
                        message=f"Input richiesto '{name}' non collegato né valorizzato",
                    )
                )

    # 4. tipi di porta incompatibili sugli archi (solo se lo schema di entrambi i nodi è noto)
    for edge in valid_edges:
        src_schema = node_schemas.get(node_by_id[edge.source].class_type)
        tgt_schema = node_schemas.get(node_by_id[edge.target].class_type)
        if src_schema is None or tgt_schema is None:
            continue
        out_type = next((o.get("type") for o in src_schema.output_summary if o.get("name") == edge.source_handle), None)
        in_type = next((i.get("type") for i in tgt_schema.input_summary if i.get("name") == edge.target_handle), None)
        if out_type and in_type and out_type != in_type:
            issues.append(
                StructuralIssue(
                    severity="error", node_id=edge.target,
                    message=f"Tipo porta incompatibile sull'arco '{edge.id}': {out_type} → {in_type}",
                )
            )

    return issues
