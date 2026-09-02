# WORKFLOW INTELLIGENCE ENGINE — design (Fase 5)

Riferimento: spec §6, §16. Secondo cuore del progetto. Traduce un **intento** (cosa vuole
ottenere l'utente) in un **workflow candidato reale**, usando solo capability
effettivamente presenti nell'installazione ComfyUI collegata — mai una lista hardcoded di
nomi nodo.

## 1. Pipeline concettuale (dalla spec, invariata)

```
INTENTO → REQUIRED CAPABILITIES → AVAILABLE COMPATIBLE NODES → CANDIDATE WORKFLOW → VALIDATION → CANVAS
```

## 2. Modello dati concettuale

```python
class CapabilityRole(BaseModel):
    role: str            # es. "model_loader", "text_encoder", "positive_prompt",
                          # "reference_image_loader", "identity_module", "sampler", ...
    required: bool
    accepts_node_output_types: list[str]   # tipi di OUTPUT che soddisfano il ruolo (es. ["MODEL"])
    produces_types: list[str]              # tipi che il ruolo deve produrre in output per i ruoli a valle

class IntentDefinition(BaseModel):
    id: str                      # "character_consistency", "text_to_image", ...
    label_it: str
    roles: list[CapabilityRole]
    role_order_hint: list[str]   # ordine logico tipico (per auto-layout)
```

Gli **intenti** e i loro **ruoli logici richiesti** sono dati versionati (non if/else
sparsi): un catalogo iniziale (§6, §13 della spec: Text-to-Image, Image-to-Image,
Character Consistency, Reference Image, Inpainting, Outpainting, Upscale, Pose/Control,
Image-to-Video, Text-to-Video) espresso come questa struttura, estensibile aggiungendo
nuove voci senza toccare il motore di risoluzione.

## 3. Mappatura ruolo → nodi reali disponibili

```python
def resolve_role(role: CapabilityRole, inventory_snapshot, family_context) -> list[NodeCandidate]:
    # 1. filtra i nodi da /object_info (via inventory) il cui OUTPUT include un tipo
    #    richiesto da role.accepts_node_output_types
    # 2. tra questi, usa compatibility_engine per scartare/segnare warning quelli
    #    incompatibili con family_context
    # 3. ordina i candidati per: (a) compatibilità (compatible > warning > unknown),
    #    (b) euristiche di preferenza dichiarate (es. nodi "core" prima di custom node
    #    equivalenti, se entrambi disponibili — solo come ordinamento, mai esclusione)
    ...
```

Punto chiave: la mappatura ruolo→nodo si basa sui **tipi di porta reali** dichiarati da
`/object_info` (es. un nodo che produce `MODEL` soddisfa strutturalmente un ruolo
`model_loader`), non sul nome del nodo. Il nome è usato solo per l'etichetta mostrata
all'utente e come segnale secondario di ranking, mai come criterio di risoluzione unico —
coerente con "NON creare un workflow intelligente usando soltanto una lista hardcoded di
node name" (§6).

## 4. Costruzione del candidate workflow

```python
def propose_workflows(intent_id, family, inventory_snapshot, character=None) -> list[WorkflowProposal]:
    intent = get_intent(intent_id)
    resolved = {role.role: resolve_role(role, inventory_snapshot, family) for role in intent.roles}
    if any(not resolved[r.role] for r in intent.roles if r.required):
        return []  # nessuna proposta possibile: dichiarato esplicitamente in UI, mai un workflow rotto silenzioso
    strategies = derive_strategies(intent, resolved, family)
    return [build_graph(intent, resolved, strategy) for strategy in strategies]
```

`derive_strategies` genera le "Strategia A/B/C" del §16 **solo quando esistono
combinazioni realmente distinte e valide** di candidati per ruoli chiave (es. più moduli
identità alternativi disponibili → più strategie "alta fedeltà" vs "più libertà posa");
se esiste una sola combinazione valida, viene proposta una sola strategia — mai nomi di
strategia inventati senza una reale differenza di capability sottostante (vincolo
esplicito §16).

## 5. Priorità: Character Consistency

Ruoli logici (dalla spec, riportati identici):
```
Model Loader
Text Encoder
Positive Prompt
Negative Prompt
Reference Image Loader
Identity / Reference Module
Latent / Image preparation
Sampler
Decoder
Save / Preview
```
Il ruolo "Identity / Reference Module" è quello con più variabilità tra installazioni
(IPAdapter, InstantID, PuLID, ReActor, o meccanismi nativi di famiglie come FLUX
Redux/Kontext) — è il ruolo che guida `derive_strategies`: ogni modulo identità
realmente installato e compatibile con la famiglia scelta genera una strategia candidata
distinta, etichettata in base al modulo effettivo (mai un'etichetta generica scollegata
dal nodo reale usato).

## 6. Validazione (collegata al validatore §26)

Prima di mostrare il candidate workflow in canvas, `validate_structure` (modulo
`workflow`, Fase 3) verifica: tutte le porte richieste collegate, nessun ciclo, tipi di
porta coerenti lungo tutti gli archi. Il risultato (lista di `StructuralIssue`) è
allegato alla proposta e mostrato con messaggi azionabili, non un generico "Error".

## 7. Apprendimento dalla knowledge base (§23)

Workflow importati e validati (Fase 8) alimentano `analyzed_workflow` come fonte per il
Compatibility Engine (vedi `docs/compatibility-engine.md` §2.4) e, in una fase successiva
a Fase 5, possono anche informare il ranking di `resolve_role` (es. "questa combinazione
di nodi per il ruolo identity_module è quella più spesso vista funzionare per FLUX").
Questo è un affinamento del ranking, mai un bypass della risoluzione basata su capability
reali.
