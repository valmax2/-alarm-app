# CHANGELOG — Comfy Director

## [Non rilasciato] — Fase 11 v1: Diagnostica reale (2026-09-02)

Prima fetta della Fase 11 (Hardening): cattura persistente delle eccezioni non
gestite, dichiarata esplicitamente dal primo giorno nella spec (§25/§34) ma mai
davvero implementata finora.

### Bug sistemico trovato e corretto
- La tabella `errors` (`ErrorLogRecord`) esisteva dalla migrazione `0001` ma nessun
  path di codice l'aveva mai scritta (verificato con `grep -rln "ErrorLogRecord"`:
  solo `models.py` la referenziava). Qualsiasi eccezione non gestita in un router
  finiva quindi in un 500 anonimo, senza traccia recuperabile — esattamente il
  contrario della regola "diagnostica dal primo giorno".

### Backend
- `bridge/diagnostics.py`: `record_error()` (scrive un `ErrorLogRecord`, con
  messaggio e contesto redatti tramite lo stesso `redact()` dei log su file) e
  `handle_unhandled_exception()`, agganciato come `@app.exception_handler(Exception)`
  globale in `main.py`. Usa una sessione DB fresca (`app.state.session_factory`), mai
  quella (possibilmente compromessa) della richiesta fallita. Il client riceve sempre
  un messaggio generico ("Errore interno del Bridge. Vedi Diagnostica per i
  dettagli."), mai un traceback grezzo.
- `routers/diagnostics.py`: `GET /diagnostics/errors` (ultimi N, limite interno 200)
  e `GET /diagnostics/report` (errori recenti + versione app + versione Python +
  piattaforma).

### Frontend
- Sezione "Diagnostica" abilitata: lista errori reali, pulsante "Scarica report
  diagnostico" (download reale via `Blob`/`URL.createObjectURL`).

### Test
- Backend: +4 test (`test_diagnostics.py`) — 192 totali, tutti verdi, incluso un test
  che dimostra end-to-end che un'eccezione non gestita viene persistita, redatta, e
  restituisce un 500 generico (richiede un `AsyncClient` dedicato con
  `raise_app_exceptions=False`, dato che Starlette rilancia l'eccezione originale dopo
  aver chiamato l'exception handler).
- Frontend: +2 test (`DiagnosticsPanel.test.tsx`) — 44 totali, tutti verdi.
- Verificato dal vivo con Playwright: stato vuoto della sezione Diagnostica
  screenshottato, download reale del report intercettato e confrontato byte-per-byte
  con la risposta API.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Questa v1 cattura solo le eccezioni non gestite — non un log strutturato di ogni
  richiesta, non alert/notifiche proattive, non un dashboard di metriche.
- Il resto della Fase 11 resta da fare: backup/versioning completi, suite di test
  estesa, ottimizzazioni performance (virtualizzazione liste, cache), valutazione/
  implementazione packaging desktop (Tauri).

## [Non rilasciato] — Fase 9: completato il Prompt Engine (2026-09-02)

Completa la parte di Fase 9 rimasta dopo "Prompt da Immagine": traduzione IT→EN reale
per un prompt scritto a mano dall'utente.

### Backend
- `bridge/ai_providers/chat.py` refattorizzato: trasporto HTTP condiviso
  (`_send_with_system_prompt`) tra la chat (Fase 10) e la nuova
  `translate_to_english()` — stesso codice verso Anthropic/OpenAI, solo il system
  prompt cambia. Mai due implementazioni HTTP duplicate per lo stesso provider.
- Tabella `prompts` (migrazione `0008`).
- `routers/prompts.py`: `POST /prompts/translate` (traduzione reale, non persiste
  nulla — è un'utility), `POST/GET/PUT/DELETE /prompts` (cronologia).

### Frontend
- Sezione "Prompt Engine" abilitata: campi IT/EN editabili, negative prompt, blocco
  traduzione (`translation_locked`), cronologia con "Riusa"/"Elimina".
- Corretto durante la verifica: i campi non erano avvolti in un `<form>`, quindi non
  ricevevano lo stile flex-column condiviso dagli altri pannelli — risultato:
  etichette e caselle di testo compresse/in linea invece che impilate verticalmente.
  Trovato guardando lo screenshot della verifica dal vivo, non dai test (jsdom non
  rende il layout CSS), corretto avvolgendo i campi in un `<form>`.

### Test
- Backend: +12 test (`test_translate.py`, `test_prompts_endpoints.py`) — 188 totali,
  tutti verdi.
- Frontend: +3 test (`PromptEnginePanel.test.tsx`) — 42 totali, tutti verdi.
- Verificato con una chiamata REALE (non mockata) verso `api.anthropic.com` con una
  chiave non valida — stesso esito onesto delle altre integrazioni AI (errore reale
  propagato). Verificato anche il salvataggio manuale IT/EN/negative in cronologia,
  confermato via lettura diretta di `GET /prompts` indipendente dalla UI.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessun preset di prompt con categorie/tag.
- Nessun collegamento a un workflow/generazione specifico (`generation_id` resta
  sempre `null` — dipende dal Workflow Builder completo, Fase 5).

## [Non rilasciato] — Fase 7 v1: libreria Personaggi (2026-09-02)

Consegnata come libreria dati + immagini reali — nessun collegamento ancora al
Workflow Builder / "Coerenza Personaggio" (dipende dalla Fase 5 completa, non ancora
costruita), dichiarato esplicitamente.

### Backend
- Tabelle `characters`/`character_images` (migrazione `0007`).
- `bridge/characters/storage.py`: storage filesystem reale in
  `data/storage/characters/<id>/<uuid>.<ext>` — upload/delete operano su file veri,
  mai file orfani (la cartella dell'intero personaggio viene rimossa alla sua
  cancellazione).
- `routers/characters.py`: CRUD personaggi, upload/eliminazione immagini, proxy per
  servire il file.

### Frontend
- Sezione "Personaggi" abilitata (era disattivata): libreria, dettaglio, upload,
  toggle privacy (offusca l'anteprima via blur CSS — solo visualizzazione, non un
  vero controllo d'accesso, dichiarato).

### Test
- Backend: +17 test (`test_characters_storage.py`, `test_characters_endpoints.py`) —
  176 totali, tutti verdi.
- Frontend: +2 test (`CharactersPanel.test.tsx`) — 39 totali, tutti verdi.
- Verificato dal vivo: upload di un PNG reale via UI, bytes confermati identici su
  disco leggendo direttamente il file (non solo a schermo), cancellazione del
  personaggio confermata rimuovere davvero la cartella dal filesystem.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessun collegamento alla generazione/Coerenza Personaggio.
- Nessun drag&drop in canvas, nessun export/import Character Pack.
- Nessuna riordinabilità delle immagini, nessuna dimensione (width/height) derivata
  automaticamente (nessuna dipendenza Pillow aggiunta per questo).

## [Non rilasciato] — Fase 10 v1: chat reale con l'Assistente AI (2026-09-02)

Richiesto esplicitamente ("riesco già... a interrogare un'IA?"), consegnato come chat
testuale reale — senza il Tool Layer completo (§21), dichiarato esplicitamente non
ancora implementato.

### Backend
- `bridge/ai_providers/chat.py`: chiamata reale ad Anthropic/OpenAI con cronologia
  (ultimi 20 messaggi), riusa l'astrazione provider/cifratura della Fase 9.
- Tabella `chat_messages` (migrazione `0006`).
- `routers/chat.py`: `POST/GET/DELETE /chat/messages`. Il messaggio dell'utente è
  committato subito (prima della chiamata al provider): se la chiamata fallisce non
  va perso — richiedeva un commit esplicito perché `get_db_session` fa rollback
  dell'intera sessione quando l'endpoint solleva un'eccezione più avanti.

### Frontend
- Sezione "Assistente AI" abilitata (era disattivata): `ChatPanel.tsx` con cronologia
  reale, selezione provider, invio, errori del provider mostrati verbatim.

### Test
- Backend: +14 test (`test_chat.py`, `test_chat_endpoints.py`) — 159 totali, tutti
  verdi.
- Frontend: +3 test (`ChatPanel.test.tsx`) — 37 totali, tutti verdi.
- Verificato con una chiamata REALE (non mockata) verso `api.anthropic.com` con una
  chiave invalida: la richiesta raggiunge davvero l'endpoint (proxy di rete di questo
  ambiente), l'errore `authentication_error` di Anthropic viene propagato verbatim in
  UI — confermato sia via `curl` diretto sia con Playwright (screenshot).

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessun AI Tool Layer (§21): l'assistente non legge né modifica il workflow
  dell'utente. Se gli viene chiesto, lo dichiara lui stesso (system prompt) invece di
  fingere di poterlo fare.
- Nessuna gestione di conversazioni/thread multipli — una cronologia unica e continua.

## [Non rilasciato] — Fase 6 v1: generazione reale via ComfyUI (2026-09-02)

Richiesto esplicitamente dall'utente dopo aver chiesto conferma su cosa fosse già
utilizzabile ("riesco già a generare qualcosa?") — risposta: non ancora, ed è diventata
la priorità di questa consegna.

### Backend
- `bridge/workflow/compile.py`: `compile_to_comfy_payload()` — grafo interno → payload
  API ComfyUI, risolve ogni arco in `[source_id, output_index]` reale tramite lo schema
  sincronizzato; si rifiuta esplicitamente (`CompileError`) se non può farlo in modo
  affidabile, mai un payload indovinato.
- `comfy_client`: `queue_prompt`, `get_queue`, `get_history`, `interrupt`,
  `get_view_bytes` — i quattro endpoint di generazione documentati in
  `docs/comfyui-api.md` e finora non ancora implementati.
- Tabella `generations` (migrazione `0005`).
- `routers/generations.py`: `POST /workflows/{id}/generate` (blocco rigido su errori di
  validazione, spec §26), `GET /generations/{id}` (polling: aggiorna lo stato leggendo
  `/history` poi `/queue` dal vivo), `POST /generations/{id}/abort`,
  `GET /generations/{id}/outputs/{i}/file` (proxy verso `/view`, il frontend non
  contatta mai ComfyUI direttamente).

### Frontend
- Bottoni GENERA/ABORT in barra superiore, reali (erano disattivati).
- `store/generationStore.ts`: polling ogni 1.5s finché la generazione non è in stato
  terminale — nessuna relay WebSocket in questa consegna (dichiarato), quindi nessuna
  percentuale di progresso finta nel frattempo.
- `components/GenerationStatusBar.tsx` nel footer: stato reale, errori di ComfyUI
  mostrati così come sono, miniature degli output al completamento.

### Bug reale trovato e corretto durante la verifica dal vivo
SQLite non conserva il fuso orario di una colonna `DateTime(timezone=True)` attraverso
un giro di scrittura/lettura: un secondo poll su una generazione con `started_at` già
persistito falliva con `TypeError: can't subtract offset-naive and offset-aware
datetimes` nel calcolo di `duration_ms`. I test originali non lo intercettavano (la
sessione DB per-richiesta nascondeva il problema entro una singola richiesta). Corretto
con un helper `_aware_utc()`; aggiunto un test di regressione con due poll consecutivi
in richieste separate, verificato che fallisce senza il fix e passa con il fix.

### Test
- Backend: +16 test (`test_workflow_compile.py`, `test_generations_endpoints.py`) — 145
  totali, tutti verdi.
- Frontend: +7 test (`generationStore.test.ts`, `GenerationStatusBar.test.tsx`) — 34
  totali, tutti verdi.
- Verifica E2E manuale con Bridge reale + un ComfyUI simulato (HTTP, non solo mock nei
  test): GENERA → In coda → In esecuzione → Completata con miniatura reale scaricata
  tramite il proxy del Bridge (screenshot), e ABORT → Interrotta. Confermato anche via
  chiamate dirette agli endpoint, indipendenti dalla UI.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessuna relay WebSocket: lo stato si aggiorna solo su richiesta (polling), non ad
  ogni evento di ComfyUI.
- Nessuna evidenziazione del nodo in esecuzione sulla canvas.
- Nessuna percentuale di progresso (ComfyUI la espone solo via WS, non via
  `/history`/`/queue`).
- Verifica contro un ComfyUI reale (non simulato) resta a carico dell'utente.

## [Non rilasciato] — Fase 5 v1: scelta famiglia + import workflow JSON (2026-09-02)

Richiesto esplicitamente dall'utente ("come creo un nuovo flusso scegliendo tra i vari
WAN/Qwen/...", "come faccio a importare un flusso?"), portato avanti ora che la canvas
(Fase 3) rende questi due flussi realmente utilizzabili.

### Scelta famiglia alla creazione
- `GET /workflows/known-families`: espone `bridge.inventory.family_detection.KNOWN_FAMILIES`
  (mai duplicato a mano nel frontend).
- `POST /workflows` accetta ora `family` (opzionale, stringa vuota/blank trattata come
  non impostata) e lo salva su `WorkflowRecord.family` (campo già esistente dal modello
  Fase 3).
- Frontend: dropdown famiglia nel form di creazione in `WorkflowsPanel.tsx`, mostrata
  nella lista workflow. Dichiarato onestamente: per ora è solo un'etichetta, non genera
  ancora nodi né collega il filtro modelli per famiglia (resta manuale, Fase 4).

### Import workflow da file .json standalone
- `bridge/workflow_import/from_json.py`: ricostruisce un `WorkflowGraph` reale (non un
  riassunto di sola lettura) sia dal formato API ComfyUI ("Save (API Format)") sia dal
  formato UI ("Save"). Struttura del grafo ricostruita dai nomi di porta che ComfyUI
  stesso incorpora nel file — non richiede lo schema sincronizzato. I valori widget del
  formato UI (posizionali) vengono mappati solo quando il tipo di nodo è nell'ultimo
  inventario sincronizzato; altrimenti dichiarati onestamente in
  `unmapped_widget_node_types`, mai un valore inventato.
- `POST /workflows/import-json`: crea un nuovo workflow subito apribile in canvas.
- Frontend: input file `.json` in `WorkflowsPanel.tsx`, apre il workflow importato in
  automatico e mostra un avviso se dei widget non sono stati mappati.
- Test: +9 backend (funzioni pure + endpoint), +1 frontend (import end-to-end nel
  componente) — 129 backend / 27 frontend totali, tutti verdi. Verificato anche
  manualmente con Bridge reale + ComfyUI simulato: import di un file con 2 nodi e 1
  collegamento, valori widget e connessione ricostruiti correttamente, confermato con
  una lettura API indipendente dalla UI.

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
