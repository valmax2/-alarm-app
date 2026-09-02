"""Compilazione del modello interno verso il payload API di ComfyUI (Fase 6, spec §26,
docs/module-boundaries.md: `compile_to_comfy_payload(graph, inventory_snapshot)`).

Il payload prodotto è esattamente il formato "API" che ComfyUI accetta su `POST
/prompt`: `{node_id: {class_type, inputs: {nome: valore | [id_nodo_sorgente,
indice_output]}}}` (docs/comfyui-api.md). L'indice di output di un arco si ricava dal
NOME della porta (`GraphEdge.source_handle`) tramite lo schema sincronizzato del nodo
sorgente — perché ComfyUI stesso lavora per indice posizionale, non per nome.

Principio guida: non è compito di questa funzione decidere se il grafo è "generabile" a
livello strutturale (quello è `validate_structure`, chiamato PRIMA da chi genera, spec
§26: "blocco rigido prima di GENERA"). Ma se, arrivati qui, un arco non è risolvibile in
un indice di output reale (schema del nodo sorgente sconosciuto, o nome di porta non
presente in quello schema), la compilazione si rifiuta esplicitamente (`CompileError`)
invece di indovinare un indice — mai un payload sbagliato inviato a ComfyUI."""

from __future__ import annotations

from typing import Any

from bridge.workflow.graph import GraphNode, NodeSchemaInfo, WorkflowGraph


class CompileError(Exception):
    """Il grafo non è compilabile così com'è (arco non risolvibile in un indice di
    output reale). Il messaggio è pensato per essere mostrato all'utente."""


def compile_to_comfy_payload(graph: WorkflowGraph, node_schemas: dict[str, NodeSchemaInfo]) -> dict[str, dict[str, Any]]:
    node_by_id: dict[str, GraphNode] = {n.id: n for n in graph.nodes}
    payload: dict[str, dict[str, Any]] = {
        node.id: {"class_type": node.class_type, "inputs": dict(node.params)} for node in graph.nodes
    }

    for edge in graph.edges:
        source_node = node_by_id.get(edge.source)
        target_node = node_by_id.get(edge.target)
        if source_node is None or target_node is None:
            raise CompileError(f"Arco '{edge.id}' referenzia un nodo inesistente — impossibile compilare.")

        source_schema = node_schemas.get(source_node.class_type)
        if source_schema is None:
            raise CompileError(
                f"Il nodo '{source_node.class_type}' (id {source_node.id}) non è nell'ultimo inventario "
                "sincronizzato: impossibile risolvere l'indice di output reale per l'arco "
                f"'{edge.id}'. Sincronizza l'inventario e riprova."
            )

        output_index = next(
            (i for i, out in enumerate(source_schema.output_summary) if out.get("name") == edge.source_handle),
            None,
        )
        if output_index is None:
            raise CompileError(
                f"Il nodo '{source_node.class_type}' (id {source_node.id}) non ha una porta di output "
                f"chiamata '{edge.source_handle}' nello schema sincronizzato — l'arco '{edge.id}' non è compilabile."
            )

        payload[target_node.id]["inputs"][edge.target_handle] = [edge.source, output_index]

    return payload
