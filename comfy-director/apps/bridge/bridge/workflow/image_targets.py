"""Individuazione del widget "immagine caricabile" su un nodo ESPLICITAMENTE scelto
dall'utente (chiude un divario dichiarato in Fase 7: "nessun collegamento al Workflow
Builder" per le immagini dei Personaggi).

A differenza di `workflow.prompt_targets.find_prompt_targets` (che individua da sola
il nodo positive/negative seguendo un arco con quel nome — un'ancora strutturale che
esiste sempre su un sampler), qui non c'è un equivalente: un `LoadImage` (o un nodo
IPAdapter/faceswap di terze parti) può avere ruoli troppo diversi da workflow a
workflow per essere individuato in automatico senza rischiare di indovinare (spec:
mai inventare compatibilità). L'utente sceglie quindi ESPLICITAMENTE il nodo target
dalla lista reale dei nodi del workflow aperto; questo modulo si limita a verificare,
su QUEL nodo, quale sia l'UNICO campo che ComfyUI stesso pubblica come "scegli un file
da caricare" (`input_summary[].image_upload`, popolato da
`bridge.inventory.sync.normalize_input_summary` dal flag REALE `image_upload` di
`/object_info` — mai dedotto dal nome del campo). Se ce ne sono zero o più di uno, si
rifiuta di scegliere, dichiarando il motivo esatto."""

from __future__ import annotations

from dataclasses import dataclass

from bridge.workflow.graph import GraphNode, NodeSchemaInfo, WorkflowGraph


@dataclass(frozen=True)
class ImageWidgetTarget:
    param_name: str


def find_image_widget(
    graph: WorkflowGraph, node: GraphNode, node_schemas: dict[str, NodeSchemaInfo]
) -> tuple[ImageWidgetTarget | None, str | None]:
    schema = node_schemas.get(node.class_type)
    if schema is None:
        return None, (
            f"Il nodo '{node.class_type}' (id {node.id}) non è nell'ultimo inventario sincronizzato: "
            "impossibile verificare quale campo accetti un'immagine caricata. Sincronizza l'inventario e riprova."
        )

    connected = {edge.target_handle for edge in graph.edges if edge.target == node.id}
    candidates = [
        inp
        for inp in schema.input_summary
        if inp.get("image_upload") is True and inp.get("name") not in connected
    ]

    if len(candidates) == 1:
        name = candidates[0]["name"]
        assert isinstance(name, str)
        return ImageWidgetTarget(param_name=name), None

    if len(candidates) == 0:
        return None, (
            f"Il nodo '{node.class_type}' (id {node.id}) non ha nessun campo che ComfyUI pubblichi come "
            "'immagine da caricare': non è il nodo giusto per inviarci un'immagine."
        )

    names = ", ".join(str(c["name"]) for c in candidates)
    return None, (
        f"Il nodo '{node.class_type}' (id {node.id}) ha più campi di questo tipo ({names}): ambiguo, "
        "non ne è stato scelto uno automaticamente."
    )
