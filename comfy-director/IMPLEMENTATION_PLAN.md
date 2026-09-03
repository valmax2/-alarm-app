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

## FASE 3 — CANVAS REALE — ✅ (v1)
- ✅ Modello interno del workflow (grafo diretto tipizzato: nodi con `id`, `class_type`,
  `position`, `params`; archi con `source`/`source_handle`/`target`/`target_handle`)
  persistito lato Bridge (`workflows` + `workflow_versions`, versionato ad ogni salvataggio)
  con validazione strutturale reale (`bridge/workflow/graph.py`): nodi mancanti, cicli
  (DFS), input required non collegati né valorizzati, tipi di porta incompatibili
  (errori bloccanti in UI ma non ancora bloccanti sul salvataggio — il blocco duro
  arriva in Fase 6 con la generazione), nodi non presenti nell'ultimo sync (warning)
- ✅ Store frontend (Zustand, `workflowStore.ts`) come **unica source of truth** della
  canvas: ogni mutazione (nodo, arco, parametro) passa da lì; `openWorkflow`/`save`
  convertono da/verso il formato del Bridge nello stesso identico shape (provato dal
  test `workflowStore.test.ts`, DoD di fase)
- ✅ Integrazione React Flow (`@xyflow/react`): nodi custom (`ComfyNode`) che leggono lo
  schema reale del nodo (`GET /inventory/nodes/{class_type}/schema`, cache Fase 2/3) e
  generano gli handle di connessione reali (socket) e i widget (INT/FLOAT/STRING/
  BOOLEAN/ENUM — §11). Un nodo non più presente nell'inventario sincronizzato è
  segnalato in canvas, mai finto compatibile
- ✅ Pannello proprietà contestuale (`NodePropertiesPanel`) collegato al nodo
  selezionato: editor reale per ogni widget in base al tipo/schema, lista "ingressi
  collegati/non collegati" per i socket (mai editabili come widget), eliminazione nodo
- ✅ Ricerca/aggiunta nodo dall'inventario reale sincronizzato (`NodeSearchPalette`),
  undo/redo, eliminazione nodo/arco, minimap, controlli zoom/pan, fit-to-screen
- 🟨 **Deferito esplicitamente** (dichiarato, non finto): undo/redo è basato su
  snapshot dell'intero grafo, non un vero command pattern per-mutazione (semplificazione
  documentata, comportamento visibile identico all'utente); copy/paste e multi-select
  non implementati; auto-layout automatico (es. dagre) non implementato — il
  posizionamento dei nuovi nodi è a griglia manuale; nessun blocco "duro" al salvataggio
  in presenza di errori di validazione (il grafo si salva comunque, gli errori sono
  informativi — il blocco arriva con la Fase 6)

**DoD:** "cambiare canvas modifica realmente il workflow model, e viceversa" —
verificato (a) via test automatico (`workflowStore.test.ts`: `openWorkflow` carica il
grafo dal Bridge, `save()` lo rimanda indietro nello stesso formato) e (b) via test E2E
manuale con Bridge reale + ComfyUI simulato: modifica di un widget (`seed`) nel pannello
proprietà si riflette subito sul nodo in canvas (stesso store), e il salvataggio
incrementa la versione del workflow lato server con il valore persistito, confermato con
una `GET /workflows/{id}` indipendente dalla UI.

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

## FASE 5 — WORKFLOW BUILDER — 🟨 (v1 minimo: scelta famiglia + import JSON)
Vedi `docs/workflow-intelligence-engine.md` per la visione completa (non ancora
consegnata): catalogo intenti → capability richieste, mapping capability → nodi reali
disponibili, generazione candidate workflow, validazione, priorità assoluta al flusso
**Coerenza Personaggio** con multiple strategie derivate da capability realmente
installate (mai nomi di strategia inventati se la capability sottostante non esiste
nell'installazione). Nessuna generazione automatica di nodi in questa consegna: sarebbe
stato prematuro senza il motore intenti→capability sopra, e avrebbe rischiato di violare
la regola "mai inventare compatibilità".

Consegnato ora, su richiesta esplicita ("come creo un nuovo flusso scegliendo tra i vari
WAN/Qwen/...", "come faccio a importare un flusso?"):
- ✅ Scelta della famiglia (elenco noto da `bridge.inventory.family_detection`, via
  `GET /workflows/known-families`) alla creazione di un workflow — per ora solo
  un'etichetta salvata (`WorkflowRecord.family`), mostrata in lista e sul workflow;
  dichiarato onestamente in UI che non genera ancora nodi né filtra automaticamente i
  modelli (quel filtro nel pannello Modelli resta una scelta manuale separata, Fase 4).
- ✅ Import di un workflow ComfyUI da file `.json` standalone (non da immagine — quello
  è Fase 8): `bridge/workflow_import/from_json.py` riconosce sia il formato API
  ("Save (API Format)": `{node_id: {class_type, inputs}}`, struttura non ambigua) sia
  il formato UI ("Save": `{nodes, links}`, struttura ricostruita dai nomi di
  porta dichiarati su ciascun nodo — non serve lo schema sincronizzato). I valori dei
  widget del formato UI (array posizionale `widgets_values`) vengono assegnati SOLO
  quando il tipo di nodo è nell'ultimo inventario sincronizzato (stesso meccanismo con
  cui il frontend genera i widget in canvas); altrimenti il nodo entra comunque in
  canvas — posizione e collegamenti reali — con i parametri vuoti e il tipo elencato
  onestamente in `unmapped_widget_node_types` (mai un valore inventato). Verificato
  end-to-end con Bridge reale + ComfyUI simulato: import di un file con 2 nodi e 1
  collegamento → canvas con nodi/porte/widget corretti → confermato con una lettura
  API indipendente dalla UI.

## FASE 6 — GENERAZIONE — 🟨 (v2: polling + relay WS per il progresso live)
- ✅ `bridge/workflow/compile.py`: `compile_to_comfy_payload(graph, node_schemas)` —
  converte il grafo interno nel payload API ComfyUI (`{node_id: {class_type, inputs}}`),
  risolvendo ogni arco nel `[source_id, output_index]` reale tramite lo schema
  sincronizzato del nodo sorgente. Si rifiuta esplicitamente (`CompileError`, mai un
  payload indovinato) se un nodo sorgente non è nell'inventario sincronizzato o non ha
  la porta di output nominata nell'arco.
- ✅ `comfy_client`: `queue_prompt` (`POST /prompt`), `get_queue` (`GET /queue`),
  `get_history` (`GET /history/{id}`), `interrupt` (`POST /interrupt`, con fallback
  se il targeting per `prompt_id` non è supportato), `get_view_bytes` (`GET /view`).
- ✅ Tabella `generations` (migrazione `0005`) — un job per riga, stato
  `queued|running|completed|error|aborted`, output (filename/subfolder/type),
  eventuali `node_errors` riportati DA COMFYUI (mai reinterpretati).
- ✅ `POST /workflows/{id}/generate`: **blocco rigido** (§26) se `validate_structure`
  trova errori — compila e mette in coda solo un grafo strutturalmente valido. Se
  ComfyUI stesso rifiuta il job (`node_errors` non vuoto in risposta a `/prompt`), la
  generazione è marcata `error` subito, mai lasciata "in coda" a vuoto.
- ✅ `GET /generations/{id}`: aggiorna lo stato leggendo `/history` poi `/queue`
  dal vivo, lo persiste, lo restituisce. `POST /generations/{id}/abort` chiama
  `/interrupt` e marca `aborted` SOLO se la chiamata riesce (mai uno stato inventato
  se non sappiamo se ComfyUI ha davvero ricevuto l'abort).
  `GET /generations/{id}/outputs/{i}/file` fa da proxy verso `GET /view` (il frontend
  non contatta mai ComfyUI direttamente, unico punto di contatto = Bridge).
- ✅ Frontend: bottoni GENERA/ABORT reali in barra superiore (era disattivati, Fase 6),
  `generationStore.ts` con polling (1.5s) finché lo stato non è terminale,
  `GenerationStatusBar` nel footer con stato reale e miniature degli output completati.
- ✅ **Fase 6 v2 — relay WebSocket per il progresso live** (colma la limitazione v1
  sopra): `bridge/comfy_client/ws_relay.py` (`ComfyWSRelay`, una connessione WS
  persistente per istanza ComfyUI verso `/ws?clientId=...`, con riconnessione
  automatica) + `ws_manager.py` (`WSRelayManager`, una relay per base_url, riusata da
  tutte le generazioni sulla stessa istanza) + `ws_events.py` (parsing puro dei
  messaggi `/ws`, mai un'eccezione su un messaggio inatteso). Nuovo endpoint
  `GET /generations/{id}/live` (WebSocket): inoltra al client SOLO il progresso live
  (nodo in esecuzione, percentuale), persistendolo anche a DB (`current_node_id`,
  `progress_value`, `progress_max`, migrazione `0009`) — mai una sostituzione del
  polling REST, che resta l'unica fonte per lo stato finale/output. Se il WS non si
  connette (o il browser non lo apre), la UI degrada automaticamente a v1: mai un
  valore di progresso inventato in sua assenza. Frontend: `generationStore.ts` apre il
  canale in parallelo al polling; `ComfyNode.tsx` evidenzia con un bordo verde
  pulsante il nodo che ComfyUI sta eseguendo ORA; `GenerationStatusBar` mostra nodo +
  percentuale reali quando disponibili. Verificato dal vivo end-to-end con un fake
  ComfyUI HTTP+WS reale (non mockato: connessioni WebSocket reali in entrambe le
  direzioni) e uno screenshot Playwright del nodo evidenziato + barra di progresso.
- 🟨 **Deferito esplicitamente, dichiarato** (mai finto): nessuna live-preview delle
  immagini durante il sampling (i frame binari di preview che ComfyUI invia sullo
  stesso canale WS sono ignorati, non decodificati). Multi-istanza ComfyUI supportata
  solo in teoria (una relay per base_url) — non verificato con più istanze reali
  contemporaneamente (nessuna istanza ComfyUI reale raggiungibile in questo ambiente,
  stessa limitazione già dichiarata per `comfy_client/client.py`).

**Bug reale trovato e corretto durante la verifica dal vivo** (non dai test originali,
che non lo intercettavano — vedi `test_generations_endpoints.py`, test di regressione
aggiunto): SQLite non conserva il fuso orario di una colonna `DateTime(timezone=True)`
attraverso un giro di scrittura/lettura — un secondo poll su una generazione il cui
`started_at` era stato persistito da una richiesta precedente falliva con
`TypeError: can't subtract offset-naive and offset-aware datetimes` nel calcolo di
`duration_ms`. Corretto con un helper `_aware_utc()` che rende esplicito il fuso su
ogni timestamp riletto dal DB, verificato riproducendo il TypeError disattivando
temporaneamente il fix e confermando che il test di regressione lo cattura.

**DoD:** "workflow creato nell'app genera realmente attraverso ComfyUI" — verificato
end-to-end con Bridge reale + un ComfyUI simulato (HTTP `/prompt`, `/queue`,
`/history`, `/interrupt`, `/view`): GENERA → "In coda" → "In esecuzione" → "Completata"
con miniatura reale scaricata via il proxy del Bridge, e ABORT → "Interrotta",
confermato sia a schermo (screenshot) sia con endpoint chiamati direttamente. La
verifica contro un ComfyUI reale (non simulato) resta a carico dell'utente — checklist
in `docs/test-plan.md` e in `apps/bridge/README.md`.

## FASE 7 — PERSONAGGI — 🟨 (v3: + export/import Character Pack + invio immagini al workflow)
- ✅ Tabelle `characters`/`character_images` (migrazione `0007`) — `character_images.
  storage_path` è sempre relativo a `Settings.storage_dir`, mai base64 in DB.
  `characters.main_image_id` non è una vera FK a livello DB (evita un riferimento
  circolare con `character_images.character_id`; l'invariante è garantito dal
  codice applicativo, mai lasciato incoerente in modo osservabile dall'utente).
- ✅ `bridge/characters/storage.py`: storage filesystem reale in
  `data/storage/characters/<id>/<uuid>.<ext>` — upload salva i byte veri, delete
  rimuove davvero il file (o l'intera cartella alla cancellazione del personaggio),
  mai file orfani lasciati sul disco.
- ✅ `POST/GET/PUT/DELETE /characters`, `POST/DELETE /characters/{id}/images`,
  `GET /characters/{id}/images/{id}/file` (proxy dal disco).
- ✅ Privacy toggle (`is_private`): offusca l'anteprima in UI (blur CSS) — per
  dichiarazione esplicita dello schizzo originale è solo un controllo di
  visualizzazione, non un vero controllo d'accesso (l'immagine resta comunque
  scaricabile via URL diretto se qualcuno lo conosce — nessuna autenticazione
  esiste in questa app locale, coerente con l'architettura "un solo utente sulla
  propria macchina").
- ✅ **Oscuramento per SINGOLA immagine** (richiesto esplicitamente, oltre al
  toggle `is_private` che oscura tutte le immagini del personaggio insieme):
  colonna `character_images.is_hidden` (migrazione `0011`),
  `PUT /characters/{id}/images/{id}`, pulsante "Nascondi"/"Mostra" per ogni
  immagine — il blur si applica se il personaggio è privato OPPURE la singola
  immagine è nascosta. Preservato anche nell'export/import Character Pack
  (retrocompatibile: un pack esportato prima di questa funzione, senza il campo,
  resta importabile — `is_hidden` è semplicemente `false` di default).
- ✅ Sezione "Personaggi" abilitata in UI (era disattivata): libreria, dettaglio
  personaggio, upload/eliminazione immagini reali, verificato caricando un PNG
  reale (bytes confermati identici su disco via lettura diretta del file, non solo
  a schermo) e verificando che la cancellazione rimuova davvero la cartella.
- ✅ **Fase 7 v2 — export/import Character Pack** (colma la lacuna v1 sopra):
  `bridge/characters/pack.py` — un personaggio si esporta come archivio ZIP
  autonomo (`character.json` + `images/`) e si reimporta, sempre come riga NUOVA
  (mai riusando gli ID originali, che potrebbero già esistere sull'installazione
  di destinazione). Validazione eager e completa (manifest + ogni immagine
  referenziata) PRIMA di creare qualunque riga a DB — un pack malformato è
  rifiutato per intero con un messaggio chiaro (`CharacterPackError`), mai un
  import parziale. `GET /characters/{id}/export`, `POST /characters/import`.
  Frontend: link "Esporta Character Pack" nel dettaglio, input di import nella
  libreria. Verificato dal vivo nel browser: download reale del .zip
  (intercettato da Playwright), reimportato, personaggio duplicato indipendente
  confermato (due righe distinte, stessi dati, immagine identica byte-per-byte).
- ✅ **"Invia al workflow"** (chiude il divario appena sotto dichiarato "nessun
  collegamento alla generazione", su richiesta esplicita dell'utente di rendere
  l'app "il più possibile ottimizzata"): `bridge/comfy_client/client.py` aggiunge
  `upload_image()` — chiamata REALE (non mockata) a `POST /upload/image` di
  ComfyUI, che carica i byte dell'immagine nella sua cartella `input/` e restituisce
  il nome che ComfyUI le assegna davvero (può differire dal filename locale, per
  evitare collisioni — il codice usa SEMPRE quel nome, mai quello locale).
  `bridge/workflow/image_targets.py` (`find_image_widget()`, puro e testabile — 6
  test unitari dedicati): individua il campo "immagine caricabile" su un nodo del
  workflow scelto ESPLICITAMENTE dall'utente (mai auto-individuato — a differenza di
  `positive`/`negative` per il testo, qui non c'è un arco-ancora equivalente: un
  `LoadImage`/IPAdapter/faceswap può avere ruoli troppo diversi da workflow a
  workflow per essere indovinato senza rischiare di inventare compatibilità). Il
  segnale usato è il flag REALE `image_upload` che ComfyUI stesso pubblica su
  `/object_info` (`bridge/inventory/sync.py::normalize_input_summary`, esteso per
  catturarlo) — mai dedotto dal nome del campo. Zero o più di un campo così sul nodo
  scelto ⇒ 422 con il motivo esatto, mai un abbinamento indovinato.
  `POST /characters/{id}/images/{id}/send-to-workflow` (5 test endpoint dedicati)
  fa upload + scrive il nodo + salva una nuova versione del workflow (stessa logica
  di checkpoint già usata da "Invia al workflow" del Prompt Engine). Frontend: nella
  scheda personaggio, ogni immagine ha "Invia al workflow" → scelta workflow +
  scelta nodo (dalla lista reale dei nodi di quel workflow) + conferma che cita il
  vero nome file assegnato da ComfyUI. Verificato dal vivo nel browser con
  Playwright contro un Bridge reale (stub HTTP locale per `/object_info` E
  `/upload/image`, non mockato a livello Python): l'immagine è stata caricata
  davvero, il nome ASSEGNATO DA COMFYUI (deliberatamente diverso da quello locale
  nello stub, per provare che non è un'eco) è finito nel nodo giusto, confermato sia
  in UI sia rileggendo il workflow dal Bridge.
- 🟨 **Deferito esplicitamente, dichiarato** (mai finto): nessuna proposta
  automatica di "quale workflow/nodo usare per questo personaggio" — l'utente porta
  già un workflow aperto e sceglie lui il nodo target; quel suggerimento automatico
  dipende dal Workflow Intelligence Engine completo (Fase 5, non ancora costruito).
  Nessun drag&drop nella canvas, nessuna riordinabilità delle immagini (`order_index`
  è assegnato in ordine di caricamento), nessuna dimensione (`width`/`height`)
  derivata automaticamente dall'immagine (nessuna dipendenza Pillow aggiunta per
  questo — dichiarato, non un dato inventato).

## FASE 8 — IMPORT — 🟨 (Workflow da Immagine consegnato, portato avanti su richiesta esplicita)
Consegnato: **Workflow da Immagine** — lettura reale dei chunk PNG `tEXt`/`zTXt`/`iTXt`
(`bridge/media/png_metadata.py`, nessuna dipendenza esterna), estrazione del grafo
ComfyUI incorporato (formato `workflow` UI con layout, o `prompt` API come fallback —
`bridge/workflow_import/`), confronto con l'inventario nodi sincronizzato (Fase 2) per
segnalare componenti mancanti, endpoint `POST /workflow-import/from-image`. Mai un
workflow inventato quando i metadata non ci sono (spec §8) — verificato con un bug
reale di parsing iTXt trovato e corretto durante lo sviluppo dei test.

**Corretto (audit di robustezza, segnalato dall'utente — "carico un'immagine e poi
non vedo la fase tre"):** quando il grafo trovato è ricostruibile, l'endpoint lo
ricostruisce SUBITO come workflow reale (riusando `bridge.workflow_import.
import_workflow_json`, la stessa logica di "Importa da file .json" — mai duplicata)
e lo restituisce nel campo `workflow` della risposta; il frontend lo apre
automaticamente sulla canvas reale (Fase 3), esattamente come l'import da .json.
Prima di questa correzione l'endpoint si fermava a un elenco testuale di sola
lettura — la canvas era stata costruita da tempo (Fase 3) ma non era mai stata
ricollegata a questo flusso: un bug concreto, non solo una limitazione dichiarata.
Se il grafo trovato non è ricostruibile, `workflow` resta `null` e il motivo
compare nel messaggio (mai un fallimento silenzioso).

Non ancora consegnato in questa fase: lettura metadata WebP (solo PNG per ora).

## FASE 9 — PROMPT ENGINE — 🟨 (+ preset riutilizzabili + Smart Prompt Compiler)
Consegnato: **Prompt da Immagine** — tabella `ai_providers` cifrata a riposo (Fernet,
chiave locale mai committata — `bridge/ai_providers/crypto.py`), CRUD provider
(`POST/GET/DELETE /ai-providers`, la chiave non è mai restituita in chiaro né
mascherata), client vision reali per Anthropic e OpenAI (`bridge/ai_providers/vision.py`,
chiamate HTTP vere — verificate in questa sessione anche contro l'API reale di
Anthropic, che ha correttamente rifiutato una chiave finta con un vero errore 401,
prova che l'integrazione end-to-end funziona), schema prompt strutturato (§9: soggetto,
identità, capelli, volto, corpo/abbigliamento, posa/azione, ambiente, camera, luce,
stile, dettagli, prompt finale EN) con istruzioni esplicite per evitare deduzioni
sensibili non necessarie, endpoint `POST /prompt-from-image/analyze`, pannello
frontend (gestione provider + upload/analisi). Modalità "locale" (VLM sul PC
dell'utente) prevista nello schema ma dichiarata esplicitamente non implementata
(errore onesto invece di un risultato finto).

Consegnato ora — **Prompt Engine "proprio"**: `bridge/ai_providers/chat.py` è stato
refattorizzato per condividere il trasporto HTTP tra la chat (Fase 10) e
`translate_to_english()` (system prompt diverso, stesso codice HTTP verso Anthropic/
OpenAI — mai due implementazioni duplicate per lo stesso provider). Tabella `prompts`
(migrazione `0008`), `POST /prompts/translate` (traduzione reale, non persiste nulla —
è un'utility), `POST/GET/PUT/DELETE /prompts` (cronologia). Pannello frontend "Prompt
Engine": campi IT/EN editabili, negative prompt, blocco traduzione
(`translation_locked`, impedisce che una nuova traduzione sovrascriva un testo inglese
già rifinito a mano), cronologia con "Riusa"/"Elimina". Verificato con una chiamata
reale (non mockata) verso `api.anthropic.com` con una chiave non valida — stesso esito
onesto delle altre integrazioni AI di questa app (errore reale propagato, mai un
risultato finto).

Consegnato ora — **preset di prompt riutilizzabili**: tabella `prompt_presets`
(migrazione `0010`), distinta dalla cronologia (`prompts`, popolata automaticamente ad
ogni salvataggio) — un preset è curato dall'utente: nome, categoria opzionale, tag.
`POST/GET/PUT/DELETE /prompt-presets`, `GET /prompt-presets/tags` (tag distinti per
popolare il filtro), filtro per categoria/tag/ricerca testuale sul nome. Pannello
frontend: form "Salva come preset", lista con filtro per tag e ricerca, "Usa" ricarica
il preset negli editor e blocca automaticamente la traduzione (protegge il testo
inglese curato da un ritraduci accidentale). Verificato dal vivo nel browser con
Playwright: preset salvato, filtrato per tag, ricaricato correttamente.

Consegnato ora — **Smart Prompt Compiler + Coerenza Personaggio** (portato —
riorganizzato in modo pulito e testabile — da un'altra app dell'utente, "PromptStudio",
su sua richiesta esplicita: "qui volevo organizzarla meglio"): `bridge/prompt_engine/`
(`catalogs.py` — vocabolario di prompt engineering: corpo per genere, viso, capelli+
colore, abbigliamento, azione/posa/ambiente, camera framing/angolo/lens, luce, tutto
puro dato tipizzato; `compiler.py` — `compose_prompt()`/`coherent_identity_block()`,
puro e testabile, 23 test unitari dedicati). `GET /prompt-engine/catalog`,
`POST /prompt-engine/compose` (utility pura come `/prompts/translate`, non persiste).
Frontend: sezione "Costruzione guidata" nel Prompt Engine — menu guidati invece di
scrivere il prompt a mano, con un selettore di **Personaggio coerente** dalla libreria
(Fase 7): selezionandone uno, il blocco di coerenza d'identità (nome/descrizione/tag/
note del personaggio) sostituisce la descrizione generica del viso, mai sommato.
Adattamenti deliberati rispetto all'originale, dichiarati nel modulo: nessun controllo
camera interattivo trascinabile (solo i cataloghi), nessuna modalità "viso da immagine
di riferimento generica" (solo Personaggi della libreria, mai un'immagine anonima).
Verificato dal vivo nel browser con Playwright: personaggio creato, prompt composto
con corpo/azione/camera/luce reali + blocco di coerenza identità, tutto verificato nel
campo "Prompt (inglese)".

Consegnato ora — **selettore acconciature con anteprime visive** (porting da
PromptStudio, su richiesta esplicita dell'utente): `HairPreviewPicker.tsx`, sostituisce
i due menu a tendina "Stile capelli"/"Colore capelli" della Costruzione guidata (quando
la modalità è "Cambia acconciatura") con una griglia di pulsanti fotografici, raggruppati
per categoria, cliccabili per selezionare/deselezionare. `src/data/hairPreviews.ts`
(generato programmaticamente via regex sull'originale `hair_previews.js`, mai
ritrascritto a mano) mappa 73 stili + 18 colori (delle 84 foto totali bundlate in
`public/hair-previews/`) al loro `value_en` del catalogo; una voce del catalogo senza
foto reale resta un pulsante di solo testo — mai un abbinamento indovinato. Le foto
sono servite come asset statici Vite (`public/`), nessun coinvolgimento del backend.
Verificato dal vivo nel browser con Playwright: griglia con foto reali caricate, stile
e colore selezionati (evidenziati), prompt composto contiene i relativi frammenti
inglesi.

Consegnato ora — **"Invia al workflow"** (chiude il divario appena sopra dichiarato
"nessun collegamento a un workflow specifico"): `bridge/workflow/prompt_targets.py`
(`find_prompt_targets()`, puro e testabile — 7 test unitari dedicati) individua
STRUTTURALMENTE, mai per nome di classe hardcodato, il nodo di testo libero collegato
agli input `positive`/`negative` di un workflow — segue l'arco che porta a
quell'handle (nome che viene dallo schema reale sincronizzato, stesso principio già
usato in `workflow.compile`), poi tra gli input `STRING` non collegati del nodo
sorgente cerca l'UNICO campo widget: se ce ne sono zero o più di uno, non indovina,
dichiara il motivo esatto. `POST /workflows/{id}/apply-prompt` (5 test endpoint
dedicati) scrive il prompt lì e salva una nuova versione del workflow — un `positive`
non risolvibile fa fallire la richiesta con 422 e il motivo reale; un `negative`
richiesto ma non risolvibile è un warning, non blocca l'invio del positivo. Frontend:
sezione "Invia al workflow" nel Prompt Engine — scelta del workflow di destinazione,
un pulsante, e il messaggio di conferma cita il vero nodo/classe/versione restituiti
dal Bridge (mai un "fatto" generico). Verificato dal vivo nel browser con Playwright
contro un Bridge reale (inventario sincronizzato da uno stub HTTP locale, non
mockato a livello Python): prompt positivo+negativo scritti davvero nei due nodi
`CLIPTextEncode` del workflow di test, confermato sia nella UI sia rileggendo il
workflow dal Bridge.

Non ancora consegnato — più significativo: il collegamento riguarda solo il grafo del
workflow (il testo finisce nel nodo), non ancora `prompts.generation_id` (la
cronologia prompt e la generazione restano tabelle distinte, mai collegate
automaticamente) né un percorso "componi → invia → genera" in un solo click (bisogna
comunque aprire il pannello Workflow e premere GENERA separatamente).

Consegnato ora — **Body Director** (porting da PromptStudio, `body_director.js`, su
richiesta esplicita dell'utente di rendere l'app "il più possibile ottimizzata"):
`BodyZonePicker.tsx` sostituisce l'elenco piatto di 10-13 menu a tendina del corpo in
fila con zone cliccabili (Corpo/Torace-Seno/Vita/Fianchi/Glutei/Gambe/Pelle, stessa
mappa zona→categorie dell'originale) che aprono solo le categorie di quella zona come
pulsanti selezionabili, con il conteggio delle selezioni già fatte per zona.
Adattamento deliberato: pura riorganizzazione UI dello stesso catalogo già portato in
Fase 9 (Task #32, le chiavi dei gruppi in `catalogs.py` corrispondono già 1:1 a quelle
di `targetGroups` nell'originale) — nessun dato nuovo, nessuna chiamata backend
aggiuntiva. 6 test unitari dedicati (`BodyZonePicker.test.tsx`). Verificato dal vivo
nel browser con Playwright: 7 zone reali mostrate per il genere femminile, zona "Vita"
aperta, opzione "Stretta" selezionata (conteggio "Vita (1)" visibile), prompt composto
contiene davvero `narrow waist`.

Consegnato ora — **Camera Director** (porting da PromptStudio, `cameraDirectorPrompt()`
in `app.js`, su richiesta esplicita dell'utente): `bridge/prompt_engine/compiler.py`
aggiunge `camera_director_prompt(orbit, elevation, distance, fov, tilt) -> str`, pura e
testabile — cinque parametri numerici mappati fedelmente (stessi confini di bucket
dell'originale) a frasi inglesi di posizionamento camera. Quando attivo
(`StructuredPromptInput.camera_director_active`), SOSTITUISCE del tutto i cataloghi
framing/angolo/lens (mai una fusione parziale — stessa regola dell'originale: "sostituisce
DEL TUTTO i pulsanti Taglio/Inquadratura"). Frontend: `CameraDirector.tsx` — un
checkbox di attivazione + cinque slider (stessi range dell'originale: orbita -180/180,
elevazione -60/60, distanza 30/140, FOV 20/100, tilt -30/30) nella sezione "Camera e
luce" della Costruzione guidata. Adattamenti deliberati, dichiarati nel modulo: nessuna
vista 3D trascinabile (i tre diagrammi SVG top/frontale/destra dell'originale — solo i
cinque slider numerici e il testo che producono davvero); non portata la versione più
sofisticata di `smart_prompt_compiler.js` (token-budget splitting della Regia in
singole frasi, fusione parziale lens+Regia in certe condizioni) — qui la Regia è un
unico frammento e sostituisce sempre framing/angolo/lens quando attiva, mai una
fusione parziale, comportamento identico alla versione base `composePrompt`/`app.js`.
9 nuovi test unitari sulla funzione pura (un confine di bucket per test) + 2 test
sulla sostituzione/non-sostituzione in `compose_prompt` + 1 test endpoint + 5 test
frontend (`CameraDirector.test.tsx`). Verificato dal vivo nel browser con Playwright: taglio
"Primo piano" impostato dal catalogo, poi Regia attivata con orbita a 90°, prompt
composto contiene `camera positioned directly to the subject's right side, profile
view` e NON contiene più `FRAMING — STRONG:` — la sostituzione è reale, non solo
dichiarata.

Provider Runware.ai alternativo (generazione cloud) — **deliberatamente NON portato**:
posto esplicitamente all'utente (comporta un secondo motore di generazione a
pagamento, con una chiave API propria, in aggiunta a ComfyUI locale) e l'utente ha
scelto di restare solo su ComfyUI locale, coerente con l'identità originale del
progetto ("un livello di gestione intelligente sopra ComfyUI locale", §0 della spec).
Con questo si chiude l'intero backlog di porting da PromptStudio individuato in
questa fase: Smart Prompt Compiler, Coerenza Personaggio, selettore acconciature,
Body Director, Camera Director, "Invia al workflow" — tutti consegnati e verificati
dal vivo; solo Runware.ai scartato per scelta esplicita dell'utente.

## FASE 10 — AI ASSISTANT — 🟨 (v1: solo chat, nessun Tool Layer)
- ✅ `bridge/ai_providers/chat.py`: chiamata REALE (non simulata) ad Anthropic
  `/v1/messages` o OpenAI `/v1/chat/completions` con cronologia (ultimi 20 messaggi),
  riusando la stessa astrazione provider/cifratura costruita in Fase 9 (mai ricostruita
  — coerente con `docs/module-boundaries.md`).
- ✅ Tabella `chat_messages` (migrazione `0006`) — conversazione unica e continua
  (nessuna gestione di thread multipli in v1). Il messaggio dell'utente viene
  committato subito, prima del tentativo di chiamata al provider: se la chiamata
  fallisce non va perso (l'utente non deve riscriverlo).
- ✅ `POST /chat/messages`, `GET /chat/messages`, `DELETE /chat/messages`.
- ✅ Sezione "Assistente AI" abilitata in UI (era disattivata): cronologia reale,
  selezione provider, invio, errori del provider mostrati così come sono (mai una
  risposta inventata se la chiamata fallisce).
- ✅ Verificato con una chiamata REALE (non mockata) verso `api.anthropic.com` con una
  chiave invalida: la richiesta raggiunge davvero l'endpoint, l'errore
  `authentication_error` di Anthropic viene propagato verbatim in UI — stessa modalità
  di verifica già stabilita per "Prompt da Immagine" (Fase 9).
- 🟨 **Deferito esplicitamente, dichiarato** (mai finto): **nessun AI Tool Layer** (§21)
  — l'assistente non legge né modifica ancora il workflow dell'utente (nessun
  `get_current_workflow`/`add_node`/`connect_nodes`/`set_node_parameter` ecc.), nessun
  meccanismo di preview/applica/annulla (§22). Il system prompt dell'assistente lo
  dichiara esplicitamente all'utente se gli viene chiesto di modificare il workflow,
  invece di fingere di poterlo fare. Implementarlo ora, senza un meccanismo di
  preview/conferma reale prima di mutare il workflow, avrebbe rischiato di violare
  proprio la regola che il Tool Layer è pensato per rispettare.

## FASE 11 — HARDENING — 🟨 (v1: diagnostica reale, il resto ancora da fare)
- ✅ `bridge/diagnostics.py`: exception handler globale (`@app.exception_handler(Exception)`
  in `main.py`) — nessuna eccezione non gestita spariva più in un 500 anonimo (bug
  sistemico presente dal primo giorno: la tabella `errors`/`ErrorLogRecord` esisteva
  dalla migrazione `0001` ma non veniva mai scritta da nessun path di codice, trovato
  con un grep mirato). Ora ogni eccezione non gestita viene persistita (livello,
  sorgente `METODO /path`, messaggio, traceback in `context`, redatti con lo stesso
  `redact()` usato per i log — verificato con un test che una stringa "segreta" nel
  messaggio d'eccezione non compare mai in chiaro nella riga salvata) usando una
  sessione DB FRESCA (`app.state.session_factory`), mai quella della richiesta che ha
  fallito. Il client riceve sempre un messaggio generico, mai un traceback grezzo.
- ✅ `GET /diagnostics/errors` (ultimi N, limite interno 200), `GET /diagnostics/report`
  (errori recenti + versione app + versione Python + piattaforma).
- ✅ Sezione "Diagnostica" abilitata in UI: lista errori reali, pulsante "Scarica report
  diagnostico" (download reale via `Blob`/`URL.createObjectURL`, verificato con un vero
  download intercettato da Playwright).
- 🟨 **Deferito esplicitamente, dichiarato** (mai finto): questa v1 cattura solo le
  eccezioni non gestite — non un log strutturato di ogni richiesta, non alert/notifiche
  proattive, non un dashboard di metriche. Il resto della Fase 11 (backup/versioning
  completi, suite di test estesa, ottimizzazioni performance — virtualizzazione liste,
  cache —, valutazione/implementazione packaging desktop Tauri, vedi ADR §7) resta da
  fare.

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
