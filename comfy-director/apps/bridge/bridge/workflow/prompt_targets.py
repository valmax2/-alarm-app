"""Individuazione dei nodi "prompt di testo" in un workflow.

Chiude un divario dichiarato esplicitamente in Fase 9 (`IMPLEMENTATION_PLAN.md`):
finora il Prompt Engine componeva un testo che l'utente doveva ricopiare a mano nel
nodo giusto sulla canvas — `prompts.generation_id` restava sempre `null`. Questo
modulo permette a `POST /workflows/{id}/apply-prompt` (routers/workflows.py) di
inserire il testo composto direttamente nel workflow, senza copia-incolla manuale.

Deliberatamente strutturale, non basato sul nome della classe del nodo: mai
assumere "il nodo prompt è CLIPTextEncode" — un custom node di terze parti può
avere un ruolo identico con un `class_type` diverso (spec: mai inventare
compatibilità). Si individua invece, usando solo dati che il grafo e l'inventario
sincronizzato già portano:

1. l'arco il cui `target_handle` è letteralmente ``"positive"`` (o ``"negative"``)
   — questi nomi vengono dallo schema REALE del nodo che li riceve, sincronizzato
   da ComfyUI (stesso principio di `workflow.compile.compile_to_comfy_payload`,
   che risolve gli indici di output per nome e non per posizione assunta);
2. il nodo SORGENTE di quell'arco, e tra i suoi input di tipo ``STRING`` non
   collegati da un altro arco (quindi widget, non socket) secondo il suo schema
   sincronizzato, l'UNICO campo di testo libero.

Se il passo 1 non trova nessun arco `positive`, o il passo 2 trova zero o più di
un candidato, non si indovina: il motivo esatto finisce in `PromptTargets.issues`
e la chiamata HTTP restituisce quel motivo all'utente (mai un abbinamento
indovinato, mai un fallimento silenzioso)."""

from __future__ import annotations

from dataclasses import dataclass

from bridge.workflow.graph import GraphNode, NodeSchemaInfo, WorkflowGraph


@dataclass(frozen=True)
class PromptTextTarget:
    node_id: str
    class_type: str
    param_name: str


@dataclass(frozen=True)
class PromptTargets:
    positive: PromptTextTarget | None
    negative: PromptTextTarget | None
    # Spiegazioni testuali (in italiano, pensate per essere mostrate all'utente) di
    # ogni motivo per cui `positive`/`negative` sono rimasti `None`.
    issues: list[str]


def _incoming_handles(graph: WorkflowGraph, node_id: str) -> set[str]:
    return {edge.target_handle for edge in graph.edges if edge.target == node_id}


def _find_role_source(graph: WorkflowGraph, role: str) -> str | None:
    """Id del nodo sorgente del primo arco del grafo il cui `target_handle` è
    esattamente `role` — di norma l'input `positive`/`negative` del sampler."""
    for edge in graph.edges:
        if edge.target_handle == role:
            return edge.source
    return None


def _resolve_text_widget(
    graph: WorkflowGraph, node: GraphNode, node_schemas: dict[str, NodeSchemaInfo], role: str
) -> tuple[PromptTextTarget | None, str | None]:
    schema = node_schemas.get(node.class_type)
    if schema is None:
        return None, (
            f"Il nodo collegato a '{role}' (id {node.id}, tipo '{node.class_type}') non è nell'ultimo "
            "inventario sincronizzato: impossibile verificare quale campo sia di testo libero. "
            "Sincronizza l'inventario e riprova."
        )

    connected = _incoming_handles(graph, node.id)
    candidates = [
        inp
        for inp in schema.input_summary
        if inp.get("type") == "STRING" and inp.get("name") not in connected
    ]

    if len(candidates) == 1:
        name = candidates[0]["name"]
        assert isinstance(name, str)
        return PromptTextTarget(node_id=node.id, class_type=node.class_type, param_name=name), None

    if len(candidates) == 0:
        return None, (
            f"Il nodo collegato a '{role}' (id {node.id}, tipo '{node.class_type}') non ha nessun campo "
            "di testo libero: impossibile inviare il prompt automaticamente."
        )

    names = ", ".join(str(c["name"]) for c in candidates)
    return None, (
        f"Il nodo collegato a '{role}' (id {node.id}, tipo '{node.class_type}') ha più campi di testo "
        f"libero ({names}): ambiguo, non ne è stato scelto uno automaticamente."
    )


def find_prompt_targets(graph: WorkflowGraph, node_schemas: dict[str, NodeSchemaInfo]) -> PromptTargets:
    node_by_id = {n.id: n for n in graph.nodes}
    issues: list[str] = []

    positive_target: PromptTextTarget | None = None
    positive_source_id = _find_role_source(graph, "positive")
    if positive_source_id is None:
        issues.append(
            "Nessun arco nel workflow porta a un input chiamato 'positive': impossibile individuare "
            "automaticamente dove inserire il prompt."
        )
    else:
        source = node_by_id.get(positive_source_id)
        if source is None:
            issues.append("L'arco verso 'positive' referenzia un nodo inesistente nel grafo.")
        else:
            positive_target, issue = _resolve_text_widget(graph, source, node_schemas, "positive")
            if issue:
                issues.append(issue)

    # Un arco 'negative' assente non è un errore: il negative prompt è opzionale,
    # molti workflow minimali non lo hanno — a differenza di 'positive', qui il
    # caso "nessun arco" non genera un issue.
    negative_target: PromptTextTarget | None = None
    negative_source_id = _find_role_source(graph, "negative")
    if negative_source_id is not None:
        source = node_by_id.get(negative_source_id)
        if source is not None:
            negative_target, issue = _resolve_text_widget(graph, source, node_schemas, "negative")
            if issue:
                issues.append(issue)

    return PromptTargets(positive=positive_target, negative=negative_target, issues=issues)
