# CONFINI DEI MODULI — Comfy Director

Rispetta la regola 4 della spec: separazione netta tra UI, modello dati workflow, Bridge
ComfyUI, inventario, Compatibility Engine, Workflow Intelligence Engine, AI Assistant,
Character Library, Prompt Engine. Questo documento definisce l'API interna di ciascun
modulo Python (dentro `apps/bridge/bridge/`) e come i moduli comunicano tra loro — mai
per accesso diretto incrociato a tabelle DB di un altro modulo, sempre tramite funzioni
pubbliche del modulo proprietario dei dati.

```
                     ┌────────────────────┐
                     │      routers/       │   adattatore HTTP/WS sottile
                     │  (FastAPI endpoints) │   nessuna logica di dominio qui
                     └─────────┬────────────┘
                               │ chiama
        ┌──────────────────────┼────────────────────────┐
        │                      │                          │
┌───────▼──────┐   ┌───────────▼───────────┐   ┌──────────▼──────────┐
│ comfy_client  │   │ inventory              │   │ workflow (core)      │
│ (Fase 1)      │   │ (Fase 2)                │   │ (Fase 3)              │
└───────┬───────┘   └───────────┬────────────┘   └──────────┬───────────┘
        │ usato da                │ usato da                  │ usato da
        │                          │                            │
┌───────▼──────────────────────────▼────────────────────────────▼───────┐
│                    compatibility_engine (Fase 4)                       │
└───────┬──────────────────────────────────────────────────────────────┘
        │ usato da
┌───────▼──────────────────────────────────────────────────────────────┐
│              workflow_intelligence (Fase 5)                            │
└───────┬──────────────────────────────────────────────────────────────┘
        │ usato da
┌───────▼──────────┐   ┌─────────────────┐   ┌──────────────────┐
│ generation        │   │ characters       │   │ prompt_engine      │
│ (Fase 6)           │   │ (Fase 7)          │   │ (Fase 9)            │
└────────────────────┘   └─────────────────┘   └──────────────────┘
                                                          │
                                                 ┌────────▼─────────┐
                                                 │  ai_assistant      │
                                                 │  (Fase 10, usa     │
                                                 │  tool layer sopra   │
                                                 │  TUTTI i moduli)     │
                                                 └────────────────────┘
```

## `comfy_client` (Fase 1)
**Responsabilità:** unico punto che parla HTTP/WS con ComfyUI. Nessun altro modulo apre
connessioni dirette a ComfyUI.

API pubblica (indicativa, tipizzata con Pydantic):
```python
class ComfyClient:
    async def get_system_stats(self) -> SystemStats | None: ...   # None se unreachable
    async def get_object_info(self) -> dict[str, NodeSchema]: ...
    async def get_object_info_for(self, class_type: str) -> NodeSchema | None: ...
    async def get_queue(self) -> QueueState: ...
    async def get_history(self, prompt_id: str | None = None) -> dict: ...
    async def submit_prompt(self, payload: dict) -> str: ...       # ritorna prompt_id
    async def interrupt(self) -> bool: ...
    async def get_image(self, filename: str, subfolder: str, type_: str) -> bytes: ...
    def connect_ws(self, client_id: str) -> AsyncIterator[ComfyEvent]: ...
```
Non solleva mai eccezioni generiche indistinte: `ComfyUnreachable`, `ComfyTimeout`,
`ComfyHTTPError(status, body)`, `ComfyProtocolError` (risposta inattesa/parsing fallito) —
per permettere ai chiamanti (router `comfy.py`, `inventory`) di dare messaggi utili
invece di "Error" generico (coerente col validatore §26).

## `inventory` (Fase 2)
**Responsabilità:** costruire/aggiornare `nodes`, `node_schemas`, `models`,
`model_metadata` a partire da `comfy_client`. Espone letture filtrate/paginate.

```python
async def sync(comfy_instance_id: str) -> SyncReport: ...   # numeri reali, mai stimati
async def list_models(filters: ModelFilters) -> Page[ModelRecord]: ...
async def list_nodes(filters: NodeFilters) -> Page[NodeRecord]: ...
async def get_node_schema(node_id: str) -> NodeSchema | None: ...
```
Non decide compatibilità (quello è `compatibility_engine`): registra solo fatti
osservati (presenza, path, hash, metadata grezzi, family detection v1 come segnale, non
come giudizio finale — vedi `docs/compatibility-engine.md`).

## `workflow` (modello interno, Fase 3)
**Responsabilità:** rappresentazione tipizzata del grafo workflow (nodi/archi/parametri),
serializzazione/deserializzazione verso `workflow_versions.graph_json`, e — solo in
Fase 6 — compilazione verso il payload API ComfyUI. Non conosce la UI (nessun concetto di
posizione X/Y è obbligatorio a questo livello, anche se viene conservato come metadato di
layout per la canvas).

```python
def load(graph_json: str) -> WorkflowGraph: ...
def dump(graph: WorkflowGraph) -> str: ...
def add_node(graph, node_type, params) -> NodeId: ...
def remove_node(graph, node_id) -> None: ...
def connect(graph, from_node, from_port, to_node, to_port) -> None: ...
def validate_structure(graph) -> list[StructuralIssue]: ...   # cicli, porte non collegate richieste, tipi porta incompatibili
def compile_to_comfy_payload(graph, inventory_snapshot) -> dict: ...   # Fase 6
def find_prompt_targets(graph, node_schemas) -> PromptTargets: ...   # Fase 9: nodo di testo libero collegato a positive/negative
```
`find_prompt_targets` (`workflow/prompt_targets.py`) individua STRUTTURALMENTE — mai
per nome di classe hardcodato — il nodo di testo libero collegato a `positive`/
`negative`: usa lo stesso principio di `compile_to_comfy_payload` (nomi di porta
risolti dallo schema sincronizzato reale, mai un'assunzione). Zero o più di un campo
`STRING` candidato ⇒ nessun target, motivo dichiarato in `PromptTargets.issues` — chi
chiama (`routers/workflows.py: apply-prompt`) decide se questo è un errore bloccante
(`positive`) o solo un warning (`negative`, opzionale).

## `compatibility_engine` (Fase 4)
Vedi `docs/compatibility-engine.md` per il design completo. API pubblica:
```python
def query(subject, target, context) -> CompatibilityResult: ...
def filter_compatible(items: list[T], context) -> list[ScoredItem[T]]: ...
def explain(result: CompatibilityResult) -> str: ...   # spiegazione leggibile per la UI/validatore
```

## `workflow_intelligence` (Fase 5)
Vedi `docs/workflow-intelligence-engine.md`. API pubblica:
```python
def list_intents() -> list[IntentDefinition]: ...
def required_capabilities(intent: str) -> list[CapabilityRole]: ...
def propose_workflows(intent, family, inventory_snapshot, character=None) -> list[WorkflowProposal]: ...
```

## `characters` (Fase 7)
CRUD personaggi + gestione immagini su filesystem (`data/storage/characters/...`), mai
logica di compatibilità o di rete qui dentro.

## `prompt_engine` (Fase 9)
Astrazione provider di traduzione/analisi immagine, indipendente da `ai_assistant`
(la chat) anche se possono condividere la stessa astrazione `AIProvider` sotto il
cofano (vedi sotto) per non duplicare il codice di gestione credenziali.

Aggiunge (Fase 9, Smart Prompt Compiler + Coerenza Personaggio, porting — riorganizzato
in modo pulito e testabile — da un'altra app dell'utente su sua richiesta esplicita):
`catalogs.py` (vocabolario statico di prompt engineering — dato editoriale, mai dati
derivati da ComfyUI) e `compiler.py` (`compose_prompt()`/`coherent_identity_block()`,
puri: prendono `CharacterInfo` già caricato, non toccano mai la sessione DB —
quell'unico punto resta `routers/prompt_engine.py`, coerente con `characters` sotto).

`prompt_engine` produce solo TESTO (`compose_prompt`, la traduzione) — non conosce
`workflow` né lo tocca mai direttamente. "Invia al workflow" (Fase 9) è
deliberatamente fuori da questo modulo: vive in `routers/workflows.py`
(`POST /{id}/apply-prompt`), che chiama `workflow.find_prompt_targets` sul grafo già
caricato — lo stesso confine di `characters`/`workflow` sopra, mai una dipendenza
diretta `prompt_engine → workflow`.

## `ai_assistant` (Fase 10)
Unico modulo autorizzato a esporre un "tool layer" (§21) che chiama le funzioni
pubbliche degli altri moduli (mai la UI direttamente, mai accesso diretto a modifiche
non validate — §22). Ogni tool è una funzione Python con schema Pydantic di
input/output, così che le "structured tool call" del modello AI possano essere validate
prima di essere eseguite.

```python
class AIProvider(Protocol):
    async def chat(self, messages, tools) -> AIResponse: ...

TOOLS = {
    "get_current_workflow": ...,
    "get_inventory": ...,
    "get_selected_node": ...,
    "search_nodes": ...,
    "search_models": ...,
    "validate_workflow": ...,
    "add_node": ...,
    "remove_node": ...,
    "connect_nodes": ...,
    "set_node_parameter": ...,
    "create_workflow": ...,
    "explain_error": ...,
}
```
Ogni tool "di scrittura" (add_node, remove_node, connect_nodes, set_node_parameter,
create_workflow) produce una **proposta di transazione** (diff sul `WorkflowGraph`) che
la UI mostra in anteprima; solo un'azione utente esplicita la applica (crea una nuova
`workflow_version`, undoable).

## Regola di comunicazione tra moduli
- Un modulo non importa mai le tabelle DB di un altro modulo direttamente: usa le
  funzioni pubbliche esposte sopra (anche se nello stesso processo, per mantenere il
  confine sostituibile/testabile in isolamento — coerente con "ogni versione deve essere
  avviabile e testabile", regola 5).
- I router FastAPI non contengono logica di dominio: validano l'input HTTP, chiamano il
  modulo, mappano l'output/errore in una risposta HTTP tipizzata.
