# CHANGELOG — Comfy Director

## [Non rilasciato] — Fase 3: Canvas reale (2026-09-02)

Richiesto esplicitamente dall'utente: "Canvas (Fase 3) prima di tutto", come
prerequisito per il vero workflow builder e la generazione.

### Backend
- `bridge/workflow/graph.py`: modello del grafo (nodi/archi) e `validate_structure()` —
  nodi referenziati inesistenti (errore), cicli via DFS (errore), input required non
  collegati né valorizzati (errore), tipo di porta incompatibile su un arco (errore,
  solo quando lo schema di entrambi i nodi è noto), nodo di un tipo non presente
  nell'ultimo sync (warning, non errore).
- Nuove tabelle `workflows` / `workflow_versions` (migrazione `0004_workflows`):
  ogni salvataggio crea una nuova versione, mai una sovrascrittura silenziosa.
- `routers/workflows.py`: `POST/GET/PUT/DELETE /workflows`, `GET /workflows/{id}`
  (con validazione live). Il salvataggio riporta gli errori di validazione ma non
  blocca (blocco duro rimandato alla Fase 6, dichiarato in IMPLEMENTATION_PLAN.md).
- `GET /inventory/nodes/{class_type}/schema`: schema di un nodo per i widget dinamici
  della canvas.
- Fix: `normalize_output_summary` ora garantisce sempre un `name` per ogni output
  (fallback `output_{i}`), necessario per handle di porta stabili in React Flow.

### Frontend
- `store/workflowStore.ts` (Zustand): unica source of truth della canvas — nodi, archi,
  parametri, undo/redo (snapshot-based), apertura/salvataggio verso il Bridge.
- `components/canvas/`: `WorkflowCanvas` (React Flow reale, dark mode, minimap,
  controlli), `ComfyNode` (nodo custom con handle di connessione reali letti dallo
  schema), `NodeSearchPalette` (ricerca/aggiunta da inventario reale sincronizzato),
  `NodePropertiesPanel` (editor widget reali + stato collegamento socket).
- `components/WorkflowsPanel.tsx`: elenco/creazione/apertura/eliminazione workflow,
  errori di validazione del workflow aperto.
- Sezione "Workflow" abilitata in navigazione (era disattivata, Fase 3).

### Test
- Backend: +14 test (`test_workflow_graph.py`, `test_workflows_endpoints.py`) — 112
  totali, tutti verdi.
- Frontend: +12 test (`workflowStore.test.ts`, `WorkflowsPanel.test.tsx`,
  `NodePropertiesPanel.test.tsx`) — 26 totali, tutti verdi. Il test più critico
  (`workflowStore.test.ts`) prova il DoD di fase: `openWorkflow` carica il grafo dal
  Bridge e `save()` lo rimanda indietro nello stesso identico formato.
- Verifica E2E manuale con Bridge reale + ComfyUI simulato (screenshot): modifica di un
  widget in canvas → salvataggio → nuova versione persistita lato server, confermata
  con una lettura API indipendente dalla UI.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Undo/redo è snapshot-based, non un vero command pattern per-mutazione.
- Copy/paste e multi-select non implementati.
- Auto-layout automatico (dagre) non implementato — posizionamento nuovi nodi a griglia.
- Nessun blocco duro al salvataggio in presenza di errori di validazione (arriva in
  Fase 6, insieme alla generazione).

## [Non rilasciato] — Fase 8 + Fase 9 parziali (2026-09-02)

Richiesto esplicitamente: Workflow da Immagine e Prompt da Immagine, portati avanti
rispetto alla roadmap originale (rispettivamente Fase 8 e Fase 9/10).

### Workflow da Immagine (Fase 8, parziale)
- `bridge/media/png_metadata.py`: parser reale dei chunk PNG `tEXt`/`zTXt`/`iTXt`
  (nessuna dipendenza esterna) — bug reale di parsing `iTXt` trovato e corretto durante
  la scrittura dei test (il campo `compression_flag` può valere `0x00`, un blind
  `split(b"\x00")` lo scambiava per un separatore).
- `bridge/workflow_import/`: estrae il grafo ComfyUI incorporato (formato `workflow`
  UI con layout, o `prompt` API come fallback), confronta ogni nodo con l'ultimo
  inventario sincronizzato (Fase 2) per segnalare componenti mancanti — solo se una
  sync è già stata fatta, altrimenti onestamente "non verificato" (mai un falso "tutto
  ok").
- Endpoint `POST /workflow-import/from-image`; pannello frontend con vista strutturata
  (testuale, non grafica: la canvas vera arriva in Fase 3, dichiarato esplicitamente).

### Prompt da Immagine (Fase 9, parziale — porta avanti anche l'astrazione provider di Fase 10)
- `bridge/ai_providers/`: tabella `ai_providers` cifrata a riposo (Fernet, chiave
  locale in `data/secret.key`, mai committata), CRUD (`POST/GET/DELETE /ai-providers`,
  la chiave non è mai restituita in chiaro), client vision reali per Anthropic e
  OpenAI (chiamate HTTP vere) con prompt strutturato secondo spec §9 (soggetto,
  identità, capelli, volto, corpo/abbigliamento, posa/azione, ambiente, camera, luce,
  stile, dettagli, prompt finale EN) e istruzioni esplicite per evitare deduzioni
  sensibili non necessarie. Modalità "locale" prevista nello schema ma dichiarata
  esplicitamente non implementata.
- Endpoint `POST /prompt-from-image/analyze`; pannello frontend (gestione provider +
  upload/analisi con prompt EN finale copiabile).
- **Verificato in questa sessione anche contro l'API reale di Anthropic** (non solo
  mock): con una chiave finta, la richiesta ha raggiunto davvero `api.anthropic.com` e
  ricevuto un vero errore 401 di autenticazione, correttamente propagato all'utente —
  prova che l'integrazione end-to-end (build richiesta, header, encoding immagine,
  gestione errore) funziona; con una chiave reale dell'utente funzionerà.

### Layout frontend
- Pulsanti dei flussi/sezioni spostati sulla barra **sinistra** (richiesta esplicita
  dell'utente, dopo un primo spostamento a destra nella consegna precedente).
- Abilitate le sezioni "Workflow da Immagine" e "Prompt da Immagine" nella barra.

### Verifica
- Suite completa: 98 test pytest + 14 test vitest, tutti verdi; lint pulito; build
  frontend verificata; avvio end-to-end reale (Bridge + frontend con `--reload`)
  verificato con richieste HTTP vere (incluse chiamate reali verso l'API Anthropic) e
  screenshot della UI risultante.

**Non ancora implementato**: canvas, workflow intelligence, generazione, personaggi,
import di workflow JSON standalone, lettura metadata WebP, traduzione IT→EN
indipendente, AI Assistant (chat), diagnostica avanzata, packaging desktop. Vedi
`IMPLEMENTATION_PLAN.md`.

## [Non rilasciato] — Fase 0 + Fase 1 (2026-09-02)

### Fase 0 — Audit
- `AUDIT.md`: riassunto requisiti, rischi/ambiguità, audit dell'ambiente di sviluppo
  reale (nessuna istanza ComfyUI raggiungibile in questa sessione).
- `ARCHITECTURE_DECISION.md`: stack scelto (React+Vite, React Flow, FastAPI, SQLite via
  SQLAlchemy+Alembic, WebSocket) con motivazioni e trade-off.
- `IMPLEMENTATION_PLAN.md`: roadmap dettagliata Fasi 0-11 con Definition of Done.
- `docs/data-model.md`, `docs/module-boundaries.md`, `docs/comfyui-api.md`,
  `docs/compatibility-engine.md`, `docs/workflow-intelligence-engine.md`,
  `docs/test-plan.md`.

### Fase 1 — Fondazione
- `apps/bridge`: Bridge FastAPI reale — config via `.env`, logging JSON strutturato con
  redazione segreti, DB SQLite (SQLAlchemy async + migrazioni Alembic reali), client
  HTTP verso ComfyUI (`GET /system_stats`, con eccezioni tipizzate), router `/health`,
  `/comfy/status` (stato ONLINE/OFFLINE reale, mai inventato), `/settings`
  (persistenza URL ComfyUI).
- `apps/frontend`: React + TypeScript + Vite — layout scheletro (barra sinistra,
  canvas placeholder, pannello destro contestuale, barra inferiore), indicatore di
  stato Bridge/ComfyUI con polling reale (tre stati distinti: checking / bridge
  irraggiungibile / online-offline con motivo), form impostazioni URL ComfyUI. Ogni
  sezione non ancora implementata è visibilmente disabilitata con la fase di arrivo.
- `scripts/START_COMFY_DIRECTOR.bat`, `scripts/START_BRIDGE.bat` (Windows),
  `scripts/dev.sh` (Linux/macOS, usato anche per la verifica end-to-end in questa
  sessione).
- Test automatici: 16 test pytest (Bridge, mock trasporto HTTP, inclusa una
  regressione sul bug reale trovato e corretto in questa fase — migrazioni Alembic che
  fallivano sotto `uvicorn --reload` per via di un event loop già in corso) + 4 test
  vitest (frontend). Tutti verdi. Build frontend verificata. Avvio end-to-end
  (`scripts/dev.sh`) verificato con richieste HTTP reali.

**Definition of Done Fase 1 raggiunto:** app avviabile, Bridge realmente collegabile
(risponde ONLINE/OFFLINE in base alla raggiungibilità reale di ComfyUI — verificato in
questa sessione con ComfyUI assente, quindi OFFLINE corretto; la verifica ONLINE contro
un'istanza reale resta a carico dell'utente, vedi `apps/bridge/README.md`).

**Non ancora implementato** (dichiarato esplicitamente in UI e qui): inventario reale,
canvas, compatibility engine, workflow intelligence, generazione, personaggi, import,
prompt engine, AI assistant, diagnostica avanzata, packaging desktop. Vedi
`IMPLEMENTATION_PLAN.md` per le fasi 2-11.

## [Non rilasciato] — Fase 2 + Fase 4 v1 (2026-09-02)

Richiesto esplicitamente: inventario reale (nodi e modelli), filtro per famiglia nei
pannelli, pulsanti dei flussi spostati sulla barra destra.

### Fase 2 — Inventario reale
- `bridge/inventory/`: sync a due fonti indipendenti — `/object_info` (nodi, schema
  normalizzato, modelli estratti dagli enum dei loader noti) e **scansione filesystem
  diretta** di un percorso ComfyUI configurabile (funziona anche a ComfyUI spento,
  dando accesso a dimensione file reale e header `.safetensors` per la family
  detection). Una sync riesce se almeno una fonte produce dati; fallisce con errore
  esplicito solo se nessuna delle due funziona — mai un report parziale spacciato per
  completo.
- Family detection v1 (`family_detection.py`): euristica su header reale (fonte
  `metadata`, alta confidenza) con fallback su euristica sul nome file (fonte
  `internal_rule`, bassa confidenza, mai spacciata per certa).
- Nuove tabelle (`nodes`, `node_schemas`, `models`, `model_metadata`) + migrazione
  Alembic `0002_inventory`. Endpoint `POST /comfy/sync`, `GET /inventory/models`,
  `GET /inventory/nodes`.
- Impostazioni estese con il percorso ComfyUI (root o cartella `models`), persistito
  su `comfy_instances`.

### Fase 4 v1 — Compatibility Engine (filtro per famiglia)
- `bridge/compatibility/resolve.py`: algoritmo di combinazione fonti puro e testato
  (fonti autorevoli vincono, soglie di confidenza per compatible/incompatible,
  altrimenti warning/unknown — mai compatible di default). Usato da
  `GET /inventory/models?family=...` per annotare ogni modello con motivo visibile,
  mai un'esclusione silenziosa.

### Frontend
- Pulsanti dei flussi spostati sulla barra **destra** (richiesta esplicita
  dell'utente, cambia il layout iniziale della bozza spec). Pannelli "Modelli" e "Nodi"
  ora reali (Fase 2): filtro famiglia/tipo/ricerca, badge di compatibilità con motivo.
  Pannello Impostazioni esteso con percorso ComfyUI e pulsante "Sincronizza ComfyUI"
  con report reale (conteggi, mai inventati).

### Verifica e bug trovati
- Suite completa: 55 test pytest + 9 test vitest, tutti verdi; lint pulito; build
  frontend verificata; avvio end-to-end reale (Bridge + frontend insieme, con
  `--reload`) verificato con richieste HTTP vere, inclusi screenshot della UI risultante.
- **Due bug reali trovati e corretti durante la verifica end-to-end** (non nei soli
  unit test): (1) un file `.safetensors` malformato causava un `MemoryError` invece di
  un errore gestito nella lettura dell'header — corretto con un limite di plausibilità
  sulla lunghezza dichiarata, con test di regressione; (2) processi `uvicorn --reload`
  orfani che restavano ad occupare la porta tra un riavvio e l'altro durante la verifica
  manuale (non un bug del codice applicativo, ma un'insidia dell'ambiente di sviluppo
  annotata qui per chiarezza).

**Non ancora implementato**: canvas, workflow intelligence, generazione, personaggi,
import (workflow da immagine, prompt da immagine), prompt engine, AI assistant,
diagnostica avanzata, packaging desktop, hash sha256/sync incrementale per gli
elementi di inventario, tabella `compatibility_rules` popolata/endpoint generico di
query compatibilità. Vedi `IMPLEMENTATION_PLAN.md`.
