# CHANGELOG — Comfy Director

## [Non rilasciato] — Correzione: "Workflow da Immagine" non apriva mai la canvas (2026-09-03)

Bug reale segnalato dall'utente ("carico un'immagine e poi non vedo la fase tre") e
confermato durante un audit di robustezza: caricando una PNG con un workflow
ComfyUI incorporato, il Bridge mostrava solo un elenco testuale — non veniva MAI
creato un workflow apribile sulla canvas reale (Fase 3, costruita da tempo ma mai
ricollegata a questo flusso).

- `routers/workflow_import.py`: quando il grafo trovato è ricostruibile, viene
  creato subito come workflow reale — riusando `import_workflow_json` (la stessa
  logica di "Importa da file .json", mai duplicata) — e restituito nel nuovo campo
  `workflow` della risposta.
- Frontend (`WorkflowFromImagePanel.tsx`): apre automaticamente quel workflow sulla
  canvas a destra, come già fa l'import da .json.
- +2 test backend (328 totali), +1 test frontend (81 totali) — quest'ultimo
  verifica che il workflow finisca DAVVERO nello store che alimenta la canvas
  (`useWorkflowStore().workflowId`/`.nodes`), non solo che compaia un messaggio.

## [Non rilasciato] — Correzione: un nodo isolato cancellato con Backspace/Canc non era annullabile (2026-09-03)

Altro bug reale trovato nello stesso audit di robustezza: nella canvas, cancellare
un nodo SENZA archi collegati con il tasto Backspace/Canc non finiva nello storico
Undo — "Annulla" non lo recuperava. (Un nodo CON archi collegati funzionava per
caso: la rimozione dei suoi archi, gestita da un percorso diverso, registrava
comunque uno snapshot completo prima che il nodo sparisse.)

- `workflowStore.ts::onNodesChange`: ora registra uno snapshot Undo quando i
  cambiamenti includono una rimozione — senza intasare lo storico per un semplice
  trascinamento del nodo (nessuno snapshot in quel caso).
- +2 test frontend di regressione.

## [Non rilasciato] — Invia immagine personaggio al workflow (2026-09-03)

Chiude il divario dichiarato in Fase 7 ("nessun collegamento alla generazione"): le
immagini di un Personaggio possono ora essere inviate direttamente a un nodo di un
workflow aperto — l'immagine viene caricata davvero su ComfyUI, non solo referenziata.

### Backend
- `bridge/comfy_client/client.py`: `upload_image()` — chiamata reale a
  `POST /upload/image` di ComfyUI. Usa sempre il nome che ComfyUI assegna
  all'immagine (può differire da quello locale per evitare collisioni), mai quello
  locale.
- `bridge/inventory/sync.py::normalize_input_summary`: cattura anche il flag reale
  `image_upload` che ComfyUI pubblica su `/object_info` — il segnale che distingue
  "scegli un file da caricare" (es. `LoadImage.image`) da un semplice elenco fisso
  (es. `sampler_name`).
- `bridge/workflow/image_targets.py` (`find_image_widget()`): individua il campo
  "immagine caricabile" su un nodo scelto ESPLICITAMENTE dall'utente (mai
  auto-individuato — a differenza di `positive`/`negative` per il testo, qui non
  c'è un arco-ancora equivalente: un nodo di terze parti può avere ruoli troppo
  diversi da workflow a workflow). Zero o più di un campo così ⇒ 422 con il motivo
  esatto.
- `POST /characters/{id}/images/{id}/send-to-workflow`: upload + scrittura del nodo
  + nuova versione del workflow.

### Frontend
- Scheda personaggio: ogni immagine ha "Invia al workflow" → scelta workflow +
  scelta nodo (dalla lista reale dei nodi di quel workflow) + conferma con il vero
  nome file assegnato da ComfyUI.

### Test
- Backend: +19 test (`test_normalize_input_summary.py` ×3, upload_image in
  `test_comfy_client.py` ×4, `test_workflow_image_targets.py` ×6,
  `test_characters_send_to_workflow_endpoint.py` ×6) — 326 totali, tutti verdi.
- Frontend: +1 test (`CharactersPanel.test.tsx`) — 78 totali, tutti verdi.
- Verificato dal vivo nel browser con Playwright contro un Bridge reale (stub HTTP
  locale per `/object_info` E `/upload/image`, non mockato a livello Python): il
  nome ASSEGNATO DA COMFYUI (deliberatamente diverso da quello locale nello stub)
  è finito nel nodo giusto, confermato in UI e rileggendo il workflow dal Bridge.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessuna proposta automatica di "quale workflow/nodo usare per questo
  personaggio" — dipende dal Workflow Intelligence Engine completo (Fase 5).

## [Non rilasciato] — Camera Director: controllo camera con 5 slider (2026-09-03)

Porting da PromptStudio (`cameraDirectorPrompt()`, `app.js`), su richiesta esplicita
dell'utente di rendere l'app "il più possibile ottimizzata": cinque parametri
numerici (orbita, elevazione, distanza, zoom/FOV, tilt) che sostituiscono del tutto i
menu Taglio/Angolo/Lens del catalogo nella Costruzione guidata.

### Backend
- `bridge/prompt_engine/compiler.py`: `camera_director_prompt(orbit, elevation,
  distance, fov, tilt) -> str`, pura e testabile — porting fedele, stessi confini di
  bucket dell'originale, per ogni frase esplicitamente nominata "camera" all'inizio
  (evita che il modello legga la frase come istruzione sulla posa del soggetto).
  Quando attivo, sostituisce del tutto i fragmenti framing/angolo/lens — mai una
  fusione parziale.
- `StructuredPromptInput`/`StructuredPromptRequest`: +6 campi
  (`camera_director_active` + i cinque parametri).

### Frontend
- `CameraDirector.tsx`: checkbox di attivazione + cinque slider (stessi range
  dell'originale) nella sezione "Camera e luce".

### Test
- Backend: +12 test (9 sui confini di bucket della funzione pura, 2 sulla
  sostituzione/non-sostituzione in `compose_prompt`, 1 endpoint) — 307 totali, tutti
  verdi.
- Frontend: +5 test (`CameraDirector.test.tsx`) — 77 totali, tutti verdi.
- Verificato dal vivo nel browser con Playwright: taglio "Primo piano" impostato dal
  catalogo, poi Regia attivata con orbita a 90°, prompt composto contiene
  `camera positioned directly to the subject's right side, profile view` e NON
  contiene più `FRAMING — STRONG:` — la sostituzione è reale.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessuna vista 3D trascinabile (i tre diagrammi SVG top/frontale/destra
  dell'originale) — solo i cinque slider numerici e il testo che producono davvero.
- Non portata la versione più sofisticata di `smart_prompt_compiler.js` (token-budget
  splitting della Regia in singole frasi, fusione parziale lens+Regia in certe
  condizioni) — qui la Regia sostituisce sempre framing/angolo/lens per intero.

## [Non rilasciato] — Body Director: navigazione a zone per il corpo (2026-09-03)

Porting da PromptStudio (`body_director.js`), su richiesta esplicita dell'utente di
rendere l'app "il più possibile ottimizzata": sostituisce l'elenco piatto di 10-13
menu a tendina del corpo in fila nella Costruzione guidata con zone cliccabili.

### Frontend
- `BodyZonePicker.tsx`: zone (Corpo, Torace/Seno, Vita, Fianchi, Glutei, Gambe,
  Pelle — stessa mappa zona→categorie dell'originale) che aprono solo le categorie
  di quella zona come pulsanti selezionabili, con il conteggio delle selezioni già
  fatte per zona sul pulsante della zona stessa.
- Pura riorganizzazione UI: riusa lo stesso catalogo body già portato in Fase 9
  (Task #32) — le chiavi dei gruppi in `catalogs.py` corrispondevano già 1:1 a
  quelle di `targetGroups` dell'originale — nessun dato nuovo, nessuna chiamata
  backend aggiuntiva.

### Test
- Frontend: +6 test (`BodyZonePicker.test.tsx`) — 72 totali, tutti verdi.
- Verificato dal vivo nel browser con Playwright: 7 zone reali per il genere
  femminile, zona "Vita" aperta, opzione "Stretta" selezionata (conteggio "Vita (1)"
  visibile), prompt composto contiene davvero `narrow waist`.

## [Non rilasciato] — Correzione: `npm run lint` era rotto dallo scaffold (2026-09-03)

`apps/frontend/eslint.config.js` non è mai esistito: ESLint 9 richiede la config flat
e senza quel file `npm run lint` falliva sempre con "ESLint couldn't find an
eslint.config.js file", fin dallo scaffold di Fase 1 — mai notato perché nessuna
verifica precedente lo eseguiva. Aggiunta la config (usa solo i pacchetti già
dichiarati in `package.json`: `@typescript-eslint/eslint-plugin`+`parser`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` — nessuna nuova
dipendenza). `no-undef` disattivato sui file `.ts`/`.tsx` (raccomandazione ufficiale
typescript-eslint: non capisce i tipi, `tsc --noEmit` in `npm run build` copre già
questi casi). Sull'intero codice reale: da 32 errori/2 warning falsi a 0 errori/1
warning innocuo e pre-esistente (un file che esporta sia un componente sia una
costante, avviso di Fast Refresh — non toccato). Rimossa anche una direttiva
`eslint-disable` in `PromptEnginePanel.tsx` che risultava inutilizzata.

## [Non rilasciato] — Invia al workflow: chiude il divario Prompt Engine → grafo (2026-09-03)

Chiude il divario dichiarato esplicitamente in Fase 9 ("nessun collegamento a un
workflow/generazione specifico"): il prompt composto nel Prompt Engine può ora essere
inserito direttamente nel nodo giusto del workflow, senza copia-incolla manuale.

### Backend
- `bridge/workflow/prompt_targets.py` (`find_prompt_targets()`): individuazione
  strutturale — mai per nome di classe hardcodato — del nodo di testo libero
  collegato agli input `positive`/`negative`, seguendo gli archi reali del grafo e lo
  schema sincronizzato del nodo sorgente. Zero o più di un campo `STRING` candidato ⇒
  nessun abbinamento indovinato, motivo dichiarato in `PromptTargets.issues`.
  7 test unitari puri dedicati.
- `POST /workflows/{id}/apply-prompt`: scrive il testo nei nodi individuati e salva
  una nuova versione del workflow (stessa logica di checkpoint di `PUT
  /workflows/{id}`, fattorizzata in `_persist_new_version`). 422 con il motivo reale
  se `positive` non è risolvibile; un `negative` richiesto ma non risolvibile è un
  warning, non blocca l'invio del positivo. 5 test endpoint dedicati.

### Frontend
- Prompt Engine: sezione "Invia al workflow" — selettore del workflow di
  destinazione, pulsante di invio, messaggio di conferma che cita il vero
  nodo/classe/versione restituiti dal Bridge (o l'errore reale, mai un fallimento
  silenzioso).

### Test
- Backend: +12 test (`test_workflow_prompt_targets.py` ×7,
  `test_workflow_apply_prompt_endpoint.py` ×5) — 295 totali, tutti verdi.
- Frontend: +3 test (`PromptEnginePanel.test.tsx`) — 66 totali, tutti verdi.
- Verificato dal vivo nel browser con Playwright contro un Bridge reale (inventario
  sincronizzato da uno stub HTTP locale che imita `/system_stats`+`/object_info`, non
  mockato a livello Python): prompt positivo+negativo scritti davvero nei due nodi
  `CLIPTextEncode` di un workflow di test, confermato sia nella UI sia rileggendo il
  workflow dal Bridge via API.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Il collegamento riguarda solo il grafo del workflow (il testo finisce nel nodo),
  non ancora `prompts.generation_id` (cronologia prompt e generazione restano tabelle
  distinte) né un percorso "componi → invia → genera" in un solo click.

## [Non rilasciato] — Selettore acconciature con anteprime visive (2026-09-03)

Porting da PromptStudio (v9.7.4-S32.9), su richiesta esplicita dell'utente
("devo poter oscurare e nascondere le immagini... qui volevo organizzarla meglio"),
completamento della Costruzione guidata già portata sopra.

### Frontend
- `HairPreviewPicker.tsx`: griglia di pulsanti fotografici raggruppati per categoria,
  sostituisce i menu a tendina testuali "Stile capelli"/"Colore capelli" quando la
  modalità è "Cambia acconciatura".
- `src/data/hairPreviews.ts`: mappa `value_en -> percorso foto`, generata
  programmaticamente via regex sull'originale `hair_previews.js` (mai ritrascritta a
  mano, per evitare errori di trascrizione) — 73 stili + 18 colori su 84 foto totali.
- `public/hair-previews/{styles,colors}/*.jpg` (84 file, ~2.0MB): asset statici serviti
  da Vite (`public/`), nessun coinvolgimento del backend.
- Una voce del catalogo senza foto reale nella mappa resta un pulsante di solo testo —
  mai un abbinamento indovinato o fuorviante.

### Test
- Frontend: +9 test (`HairPreviewPicker.test.tsx` ×4, `StructuredPromptBuilder.test.tsx`
  +1 caso) — 63 totali, tutti verdi.
- Verificato dal vivo nel browser con Playwright: griglia con foto reali caricate
  (non segnaposto), stile "Pixie classico" e colore "Rosso" selezionati (evidenziati),
  prompt composto contiene `classic pixie cut` e `red hair`.

## [Non rilasciato] — Smart Prompt Compiler + Coerenza Personaggio (2026-09-03)

Portato — riorganizzato in modo pulito e testabile — da un'altra app dell'utente
("PromptStudio v9.7.4-S32.9"), su sua richiesta esplicita: "qui volevo organizzarla
meglio". Priorità scelta tra i pezzi possibili: quello con più valore per lo sforzo,
perché estende direttamente due sistemi già costruiti in Comfy Director (Prompt
Engine e libreria Personaggi) invece di aggiungere una sezione isolata.

### Backend
- `bridge/prompt_engine/catalogs.py`: vocabolario tipizzato (corpo per genere, viso,
  capelli+colore, abbigliamento, azione/posa/ambiente, camera framing/angolo/lens,
  luce) — dato editoriale, non derivato da ComfyUI (l'hardcoding qui è corretto).
- `bridge/prompt_engine/compiler.py`: `compose_prompt()`/`coherent_identity_block()`,
  puri e testabili — 23 test unitari dedicati.
- `GET /prompt-engine/catalog`, `POST /prompt-engine/compose` (utility pura come
  `/prompts/translate`, non persiste nulla).

### Frontend
- Sezione "Costruzione guidata" nel Prompt Engine: menu guidati invece di scrivere il
  prompt a mano, con un selettore di Personaggio coerente dalla libreria — selezionarne
  uno sostituisce (mai somma) la descrizione generica del viso con un blocco di
  coerenza d'identità basato sui dati reali del personaggio.

### Test
- Backend: +30 test (`test_prompt_engine_compiler.py` ×23, `test_prompt_engine_endpoints.py`
  ×7) — 283 totali, tutti verdi.
- Frontend: +4 test (`StructuredPromptBuilder.test.tsx`) — 58 totali, tutti verdi.
- Verificato dal vivo nel browser con Playwright: personaggio creato, prompt composto
  con corpo/azione/camera/luce reali + blocco di coerenza identità, tutto confermato
  nel campo "Prompt (inglese)".

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessun controllo camera interattivo trascinabile (solo i cataloghi
  framing/angolo/lens).
- "Coerenza Personaggio" usa SOLO un Personaggio della libreria — nessun campo per
  un'immagine di riferimento generica (Comfy Director non allega ancora
  automaticamente un'immagine a un nodo del workflow, dipende dal Workflow
  Intelligence Engine completo, Fase 5).
- Restano da portare da PromptStudio: Body Director/Camera Director (editor guidati a
  step), selettore acconciature con anteprime visive, provider Runware.ai.

## [Non rilasciato] — Personaggi: oscuramento per singola immagine (2026-09-03)

Richiesta esplicita dell'utente: il toggle "Privato" del personaggio oscura TUTTE le
sue immagini insieme — mancava un oscuramento per singola immagine, indipendente.

### Backend
- `character_images.is_hidden` (migrazione `0011`).
- `PUT /characters/{id}/images/{id}` per il toggle.
- Preservato nell'export/import Character Pack — retrocompatibile: un pack esportato
  prima di questa funzione (senza il campo nel manifest) resta importabile,
  `is_hidden` di default `false`.

### Frontend
- Pulsante "Nascondi"/"Mostra" per ogni immagine nel dettaglio personaggio — il blur
  si applica se il personaggio è privato OPPURE la singola immagine è nascosta.

### Test
- Backend: +5 test (253 totali).
- Frontend: +1 test (54 totali).
- Verificato con una chiamata HTTP reale end-to-end (upload → PUT is_hidden → rilettura
  del dettaglio, valore persistito correttamente).

## [Non rilasciato] — Fase 9 v2: preset di prompt riutilizzabili (2026-09-02)

Colma la lacuna dichiarata esplicitamente in Fase 9 ("nessun preset di prompt con
categorie/tag").

### Backend
- Tabella `prompt_presets` (migrazione `0010`) — distinta da `prompts` (la
  cronologia, popolata automaticamente ad ogni salvataggio): un preset è curato
  dall'utente, con nome, categoria opzionale e tag.
- `routers/prompt_presets.py`: `POST/GET/PUT/DELETE /prompt-presets`,
  `GET /prompt-presets/tags` (tag distinti, per popolare un filtro senza doverli
  indovinare). Filtro per categoria/tag/ricerca testuale sul nome.

### Frontend
- Sezione "Preset" nel Prompt Engine: form "Salva come preset" (nome, categoria,
  tag), lista con filtro per tag e ricerca per nome, "Usa" ricarica il preset negli
  editor e blocca automaticamente la traduzione (protegge il testo inglese curato da
  un ritraduci accidentale).

### Test
- Backend: +12 test (`test_prompt_presets_endpoints.py`) — 248 totali, tutti verdi.
- Frontend: +2 test (`PromptEnginePanel.test.tsx`) — 53 totali, tutti verdi.
- Verificato dal vivo nel browser con Playwright: preset salvato con nome/categoria/
  tag, filtro per tag verificato, ricaricato negli editor con blocco traduzione
  attivato automaticamente.

## [Non rilasciato] — Fase 7 v2: export/import Character Pack (2026-09-02)

Colma la lacuna dichiarata esplicitamente in Fase 7 v1 ("nessun export/import
Character Pack").

### Backend
- `bridge/characters/pack.py`: `build_character_pack()` produce un archivio ZIP
  (`character.json` + `images/`); `parse_character_pack()` valida TUTTA la
  struttura (manifest + ogni immagine referenziata davvero presente nell'archivio)
  prima di ritornare — un pack malformato è rifiutato per intero
  (`CharacterPackError`, mai un import parziale/indovinato).
- `GET /characters/{id}/export`: fallisce con un errore chiaro (mai un pack
  silenziosamente incompleto) se un'immagine referenziata a DB manca sul disco.
- `POST /characters/import`: crea SEMPRE un personaggio nuovo (nuovo id) — un pack
  può provenire da un'altra installazione, i cui ID non hanno alcun significato
  qui.

### Frontend
- Link "Esporta Character Pack (.zip)" nel dettaglio del personaggio (download
  reale via `<a href download>`, come `generationOutputUrl`).
- Input di import nella libreria — apre il personaggio appena creato al termine.

### Test
- Backend: +17 test (`test_character_pack.py`, `test_character_pack_endpoints.py`)
  — 236 totali, tutti verdi.
- Frontend: +2 test (`CharactersPanel.test.tsx`) — 51 totali, tutti verdi.
- **Verificato dal vivo nel browser (Playwright), senza mock**: creato un
  personaggio con un'immagine PNG reale, esportato (download reale intercettato),
  reimportato lo stesso file — confermato un personaggio DUPLICATO e indipendente
  (due righe distinte, stessi dati, immagine identica byte-per-byte).

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessun collegamento al Workflow Builder / "Coerenza Personaggio" (dipende dal
  Workflow Intelligence Engine, Fase 5 completa).
- Nessun drag&drop nella canvas, nessuna riordinabilità delle immagini, nessuna
  dimensione derivata automaticamente dall'immagine.

## [Non rilasciato] — Fase 6 v2: relay WebSocket per il progresso generazione live (2026-09-02)

Colma la limitazione dichiarata esplicitamente in Fase 6 v1 ("nessuna relay
WebSocket, nessuna evidenziazione del nodo in esecuzione, nessuna percentuale di
progresso"): il polling REST resta la fonte di verità per lo stato finale/output, ma
ora un canale WebSocket push aggiorna nodo-in-esecuzione e percentuale in tempo
reale.

### Backend
- `bridge/comfy_client/ws_events.py`: parsing puro dei messaggi `/ws` di ComfyUI
  (`ComfyWSEvent`/`parse_comfy_ws_message`) — mai un'eccezione su un messaggio
  inatteso, un tipo non riconosciuto diventa `"unknown"` invece di essere scartato.
- `bridge/comfy_client/ws_relay.py`: `ComfyWSRelay`, una connessione WS persistente
  per istanza ComfyUI (`/ws?clientId=...`) con riconnessione automatica e pub/sub per
  `prompt_id`.
- `bridge/comfy_client/ws_manager.py`: `WSRelayManager` — una relay per base_url,
  riusata da tutte le generazioni sulla stessa istanza (mai una connessione per
  generazione).
- `GET /generations/{id}/live` (nuovo endpoint WebSocket, `routers/generations.py`):
  inoltra al client SOLO il progresso live, persistendolo anche a DB
  (`current_node_id`/`progress_value`/`progress_max`, migrazione `0009`) così un
  client che fa solo polling REST vede comunque un valore recente. Invia
  `final_pending` e si chiude quando ComfyUI segnala che l'esecuzione del prompt è
  terminata — mai lo stato finale/output, sempre autorevoli solo via REST.

### Frontend
- `generationStore.ts` apre il canale WS in parallelo al polling REST (che resta
  sempre attivo, invariato); se il WS non si connette o si interrompe, degradazione
  automatica e silenziosa a v1.
- `ComfyNode.tsx` evidenzia con un bordo verde pulsante il nodo che ComfyUI sta
  eseguendo ORA (l'id nodo del payload compilato è lo stesso id del nodo sulla
  canvas, nessuna mappatura necessaria).
- `GenerationStatusBar` mostra nodo in esecuzione + percentuale reali quando il WS ha
  aggiornato lo stato (mai un valore inventato in loro assenza).

### Test
- Backend: +27 test (`test_ws_events.py`, `test_ws_relay.py`,
  `test_generation_live_ws.py`) — 219 totali, tutti verdi. L'endpoint WebSocket è
  testato chiamando la funzione direttamente con un oggetto `WebSocket` fittizio
  "duck-typed" invece che tramite `starlette.testclient.TestClient`, per evitare un
  problema noto di quest'ultimo (portal/event-loop separato) con un engine SQLAlchemy
  async + aiosqlite — documentato nel docstring del file di test.
- Frontend: +5 test (`generationStore.test.ts`, `GenerationStatusBar.test.tsx`) con un
  `WebSocket` globale fittizio — 49 totali, tutti verdi.
- **Verificato dal vivo end-to-end, senza alcun mock**: un fake ComfyUI HTTP+WS reale
  (processo separato), il Bridge reale connesso ad esso con una vera connessione
  `websockets`, e un client WS reale verso `/generations/{id}/live` — sequenza di
  eventi (`executing`→`progress`→`progress`→`executing` con nodo `null`→
  `final_pending`) ricevuta correttamente, stato finale REST coerente. Poi verificato
  di nuovo nel BROWSER (Playwright): nodo evidenziato sulla canvas e percentuale live
  nella barra di stato durante l'esecuzione, completamento con miniatura dell'output.

### Dichiarato esplicitamente come non ancora implementato (mai finto)
- Nessuna live-preview delle immagini durante il sampling (i frame binari di preview
  sullo stesso canale WS sono ignorati, non decodificati).
- Multi-istanza ComfyUI supportata solo in teoria (una relay per base_url) — non
  verificabile con più istanze reali in questo ambiente.

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
