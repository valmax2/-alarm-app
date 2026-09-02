# IMPLEMENTATION PLAN — Comfy Director

Data: 2026-09-02 — Roadmap a fasi obbligatoria (spec §41), nessuna fase inizia prima che
la precedente abbia raggiunto il proprio Definition of Done (DoD). Ogni fase corrisponde
tipicamente a una o più sessioni di sviluppo dedicate, ciascuna verificata prima di
procedere (regola 6: non rompere ciò che già funziona).

Legenda stato: ⬜ non iniziata · 🟨 in corso · ✅ completata (con DoD verificato)

---

## FASE 0 — AUDIT — ✅ (questa consegna)
Deliverable: `AUDIT.md`, `ARCHITECTURE_DECISION.md`, `IMPLEMENTATION_PLAN.md` (questo
file), `docs/data-model.md`, `docs/module-boundaries.md`, `docs/comfyui-api.md`,
`docs/compatibility-engine.md`, `docs/workflow-intelligence-engine.md`,
`docs/test-plan.md`. Nessuna feature falsa dichiarata.

## FASE 1 — FONDAZIONE — ✅
Deliverable:
- repository monorepo (`apps/bridge`, `apps/frontend`, `packages/shared-types`, `data/`,
  `docs/`, `scripts/`, `tests/`)
- Bridge FastAPI reale: `config.py` (settings via `.env`/pydantic-settings, URL ComfyUI
  configurabile, mai hardcoded), `logging_config.py` (log strutturato JSON su file +
  stdout, redazione segreti), `db.py` (SQLAlchemy async engine su SQLite + Alembic),
  `models.py` (schema iniziale: `settings`, `comfy_instances`, `errors` — le restanti
  tabelle di §24 arrivano nelle fasi che le usano, per non creare schema morto non
  testato), `comfy_client/client.py` (chiamata HTTP reale a `/system_stats` per
  determinare ONLINE/OFFLINE + versione, con timeout/gestione errori reali — nessun
  numero inventato)
- Router: `GET /health` (stato processo Bridge), `GET /comfy/status` (stato reale
  ComfyUI, interroga il client), `GET/PUT /settings` (persistenza URL ComfyUI e altre
  impostazioni base)
- Frontend React+Vite minimale: pagina che mostra lo stato Bridge/ComfyUI reale
  (polling), form impostazioni URL ComfyUI, layout scheletro (barra sinistra, canvas
  placeholder dichiarata "non implementata", pannello destro placeholder) — NESSUN
  pulsante che finge funzionalità non esistenti; ogni voce non ancora attiva è
  visibilmente disabilitata/etichettata "non ancora disponibile".
- `scripts/START_COMFY_DIRECTOR.bat`, `scripts/START_BRIDGE.bat`, script di sviluppo
  Linux/Mac equivalenti (`scripts/dev.sh`) per poter verificare l'avvio in questo
  ambiente.
- Test automatici reali (pytest, mock del trasporto HTTP — nessuna chiamata di rete
  vera nei test, coerente con l'assenza di ComfyUI in questo ambiente): health,
  comfy-status online/offline/timeout, settings CRUD.

**Definition of Done (dalla spec):** "app avviabile e Bridge realmente collegabile."
Verifica concreta in questa sessione:
- `uvicorn` si avvia e risponde su `/health` (verificato con richiesta HTTP reale locale)
- `/comfy/status` restituisce `OFFLINE` quando nessun ComfyUI è in ascolto (vero in questo
  ambiente) — comportamento corretto, non un errore nascosto
- build del frontend completata senza errori (`npm run build`)
- suite pytest verde
- Se l'utente esegue lo stesso Bridge sul proprio PC con ComfyUI acceso su
  `127.0.0.1:8188`, `/comfy/status` deve restituire `ONLINE` + versione reale — questo
  passo NON è verificabile in questa sessione (nessuna istanza ComfyUI disponibile) ed è
  dichiarato come tale (vedi AUDIT.md §2).

## FASE 2 — INVENTARIO REALE — ✅ (v1)
Consegnato, con due fonti indipendenti (una sync riesce se almeno una produce dati —
vedi `bridge/inventory/sync.py`):
- Client `/object_info` reale (`ComfyClient.get_object_info`): schema completo di ogni
  nodo registrato, normalizzato in `input_summary`/`output_summary` (required/optional,
  min/max/default/step/enum) — persistito in `nodes`/`node_schemas`.
- Estrazione modelli dagli enum dei loader noti (`node_registry.py`: checkpoint, LoRA,
  VAE, ControlNet, CLIP, UNET/diffusion_model, upscale, e alcuni loader community molto
  diffusi come IPAdapter/InstantID se il nodo è realmente presente) — mai un elenco
  statico, sempre letto dal vero `/object_info`.
- **Scansione filesystem diretta** (`filesystem_scanner.py`), su richiesta esplicita
  dell'utente durante lo sviluppo: se configurato un percorso ComfyUI (root o cartella
  `models`), legge davvero i file sul disco (dimensione reale, header `.safetensors` per
  la family detection, fonte `metadata`) — **funziona anche a ComfyUI spento**, non solo
  come arricchimento di quanto riportato da `/object_info`.
- Family detection v1 (`family_detection.py`): euristica su header `.safetensors`
  (fonte `metadata`, confidenza alta) con fallback su euristica sul nome file (fonte
  `internal_rule`, confidenza bassa, mai spacciata per certa) — vedi
  `docs/compatibility-engine.md`.
- Persistenza in `nodes`, `node_schemas`, `models` (`model_metadata` esiste nello
  schema ma non è ancora popolata: gli header letti restano solo in memoria per la
  detection, non salvati grezzi — rimandato a quando servirà davvero ispezionarli dalla
  UI).
- Endpoint `POST /comfy/sync` (report reale: nodi/custom node/modelli per tipo, mai
  numeri inventati — fallisce con errore esplicito solo se NESSUNA fonte produce dati),
  `GET /inventory/models` (filtri `model_type`, `family`, `q`, `include_incompatible`),
  `GET /inventory/nodes` (filtri `is_custom_node`, `q`).

**Deviazioni dal piano originale, dichiarate esplicitamente:** nessun calcolo hash
sha256 (rimandato: costoso su file grandi, non ancora necessario senza un caso d'uso di
deduplicazione reale); nessuna sync incrementale per `mtime` (ogni sync rilegge tutto —
accettabile alla scala attuale, ottimizzazione esplicitamente Fase 11 per le
performance, spec §35); nessuna paginazione reale sulle liste (limite fisso alto).

**DoD verificato in questa sessione:** con un `/object_info` di fixture (mock HTTP) e
una cartella modelli di fixture reale su disco (non finta: file `.safetensors` nel vero
formato binario, letti byte per byte), i numeri riportati da `/comfy/sync` e
`/inventory/models|nodes` corrispondono esattamente a ciò che le fixture contengono —
incluso un bug reale trovato e corretto durante la verifica (un file `.safetensors`
malformato causava un `MemoryError` invece di un errore gestito). La verifica contro
un'installazione ComfyUI/cartella modelli reale dell'utente resta a suo carico (nessuna
istanza disponibile in questa sessione, vedi AUDIT.md).

## FASE 3 — CANVAS REALE — ⬜
- Modello interno del workflow (grafo diretto tipizzato: nodi con `type`, `id`,
  `params`, porte; archi con `from`, `to`, `type` di dato) come **unica source of truth**,
  vive nello store frontend (Zustand) e viene serializzato verso il Bridge per
  persistenza/validazione/compilazione
- Integrazione React Flow: nodi custom che leggono lo schema reale (`/object_info` via
  Bridge, cache Fase 2) e generano i widget dinamici (§11: INT/FLOAT/BOOLEAN/ENUM/
  STRING/IMAGE/MODEL/FILE/COLOR)
- Pannello proprietà contestuale collegato al nodo selezionato
- Undo/redo (command pattern sulle mutazioni del grafo), copy/paste, multi-select,
  delete, duplicate, auto-layout (es. dagre), fit-to-screen, ricerca nodo, minimap

**DoD:** "cambiare canvas modifica realmente il workflow model" — test: mutare un
collegamento in canvas e verificare che il modello serializzato cambi coerentemente, e
viceversa (modificare il modello e vedere la canvas aggiornarsi).

## FASE 4 — COMPATIBILITY ENGINE V1 — ✅ (v1 ridotto: filtro per famiglia)
Vedi `docs/compatibility-engine.md` per il design completo. Consegnato:
`bridge/compatibility/resolve.py` — algoritmo di combinazione fonti puro e testato
(`resolve()`: comfy_reported/node_schema vincono, poi soglie di confidenza per
compatible/incompatible, altrimenti warning o unknown — MAI compatible di default),
`explain()`, e `filter_models_by_family()` usato da `GET /inventory/models?family=...`
per annotare ogni modello con `compatibility` + `compatibility_reason` (mai
un'esclusione silenziosa: di default nasconde solo gli `incompatible` ad alta
confidenza, un mismatch a bassa confidenza resta `warning` visibile).

**Deviazione dal piano originale, dichiarata esplicitamente:** le regole sono
attualmente codice Python versionato (`family_detection.py`), non righe nella tabella
`compatibility_rules` (che esiste nello schema ma non è ancora popolata/letta) — una
UI per curare/estendere le regole senza toccare il codice, e l'endpoint generico
`POST /compatibility/query`, sono rimandati a quando servirà davvero gestire regole
oltre alla sola famiglia (es. Fase 5, compatibilità nodo↔nodo per il Workflow Builder).

**DoD verificato in questa sessione:** con dati di fixture (un checkpoint FLUX con
header reale, uno SDXL con header reale, uno senza famiglia rilevabile), il filtro per
famiglia produce esattamente `compatible`/`incompatible`/`unknown` coerenti con la
fonte e la confidenza — mai un'esclusione senza motivo visibile. La verifica con un
inventario reale dell'utente resta a suo carico.

## FASE 5 — WORKFLOW BUILDER — ⬜
Vedi `docs/workflow-intelligence-engine.md`. Deliverable: catalogo intenti → capability
richieste, mapping capability → nodi reali disponibili, generazione candidate workflow,
validazione, priorità assoluta al flusso **Coerenza Personaggio** con multiple strategie
derivate da capability realmente installate (mai nomi di strategia inventati se la
capability sottostante non esiste nell'installazione).

## FASE 6 — GENERAZIONE — ⬜
Compilazione modello interno → payload API ComfyUI (`POST /prompt`), tracking
queue/history, WebSocket progress relay verso il frontend, evidenziazione nodo in
esecuzione sulla canvas, ABORT (`POST /interrupt`), recupero output (`GET /view`),
persistenza `generations`.

**DoD:** "workflow creato nell'app genera realmente attraverso ComfyUI" — richiede
ComfyUI reale, verifica a carico dell'utente con checklist riprodotta in
`docs/test-plan.md`.

## FASE 7 — PERSONAGGI — ⬜
Libreria (`characters`, `character_images`), storage filesystem reale, drag&drop nel
workflow builder, privacy toggle, export/import Character Pack.

## FASE 8 — IMPORT — ⬜
Import workflow JSON (ComfyUI export e API format), lettura metadata PNG/WebP
(chunk `tEXt`/`prompt`/`workflow` di ComfyUI), ricostruzione grafo + evidenziazione
componenti mancanti, mai promettere ricostruzione se i metadata non esistono.

## FASE 9 — PROMPT ENGINE — ⬜
Astrazione provider traduzione (locale/cloud), campi IT/EN, cronologia, preset, prompt
strutturato per Prompt-da-Immagine (Fase 8/9 si intrecciano: l'estrazione prompt da
immagine via VLM condivide l'astrazione provider con la traduzione).

## FASE 10 — AI ASSISTANT — ⬜
Chat, astrazione provider (locale/OpenAI/Anthropic), AI Tool Layer (§21) con
preview/applica/annulla, mai editing diretto non validato (§22).

## FASE 11 — HARDENING — ⬜
Diagnostica avanzata con export report, backup/versioning completi, migrazioni Alembic
consolidate, suite di test estesa, ottimizzazioni performance (virtualizzazione liste,
cache), valutazione/implementazione packaging desktop (Tauri, vedi ADR §7).

---

## Principio di avanzamento

Ad ogni fase, prima di iniziare la successiva:
1. Rieseguire l'intera suite di test automatici (mai solo i test della fase corrente —
   regola 6, non rompere ciò che già funziona).
2. Aggiornare questo file (stato ⬜→🟨→✅) e `CHANGELOG.md`.
3. Aggiornare la checklist utente (spec §44) segnando quali voci sono ora realmente
   verificabili.
4. Dichiarare esplicitamente nella UI/diagnostica quali funzioni restano non
   implementate, coerentemente con la regola 10.
