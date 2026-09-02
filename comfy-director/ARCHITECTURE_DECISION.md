# ARCHITECTURE DECISION RECORD — Comfy Director

Data: 2026-09-02 · Stato: **Accettata per Fase 1**, da rivedere ad ogni fase se emergono
nuovi vincoli.

Requisiti da soddisfare (spec §30): uso principale su PC Windows, UI web/desktop a
schermo pieno, accesso filesystem locale tramite backend, comunicazione robusta con
ComfyUI, node graph performante, futuro accesso LAN/tablet, packaging futuro desktop.

---

## 1. Frontend: TypeScript + React + Vite

**Decisione:** React 18 + TypeScript, build con Vite, serve inizialmente come web-app
locale (`http://127.0.0.1:5173` in dev, build statica servita dal Bridge in produzione).

**Alternative considerate:**
- *Svelte/SvelteKit* — meno codice boilerplate, ma ecosistema di librerie node-graph e
  component library più piccolo; il team/knowledge-base di Claude Code su React è più
  profondo, riducendo rischio di bug in una base di codice che deve restare mantenibile.
- *Vue 3* — valido, stesso ragionamento di Svelte: React ha l'ecosistema più maturo per
  node-editor (vedi §2) e AI chat UI.

**Perché React vince qui:** la spec richiede molteplici pannelli contestuali dinamici
(proprietà nodo generate da schema, widget dinamici, chat, gallery) — un modello a
componenti con hook è quello con cui è più facile mantenere "una sola source of truth"
tra canvas e modello interno (§10), requisito esplicito e non negoziabile.

## 2. Node graph: React Flow (@xyflow/react)

**Decisione:** **React Flow** (pacchetto `@xyflow/react`) come libreria di canvas/grafo.

**Alternative valutate:**
| Libreria | Pro | Contro | Verdetto |
|---|---|---|---|
| **litegraph.js** (la stessa usata da ComfyUI) | Stesso "feel" esatto di ComfyUI; l'utente lo riconoscerebbe subito | API canvas-imperativa (non React), integrazione bidirezionale con lo stato React (source of truth = modello interno) più laboriosa e fragile; manutenzione upstream limitata; styling meno flessibile per pannelli contestuali React | Scartata per Fase 3, ma il **look** (nodi scuri, porte colorate per tipo, cavi curvi) viene replicato via CSS su React Flow |
| **React Flow (@xyflow/react)** | Component model nativo React, stato del grafo (nodes/edges) è semplicemente stato React → nessun problema di doppia source-of-truth; custom node rendering per i widget dinamici (§11) è il suo caso d'uso principale; virtualizzazione e performance già gestite; libreria attivamente mantenuta (ex "React Flow", ora xyflow), ampiamente usata in prodotti node-based commerciali | Aspetto default non identico a ComfyUI (va skinnato) | **Scelta** |
| **Rete.js** | Sistema a plugin flessibile | Meno maturo per React, comunità più piccola, API più complessa per il nostro caso (semplice grafo diretto) | Scartata |
| Canvas/WebGL custom | Massime performance | Costo di sviluppo enorme, reinventa quanto React Flow offre già | Scartata (over-engineering per questa fase) |

**Motivazione decisiva:** il requisito "una sola source of truth" (spec §10) è più facile
da rispettare quando il grafo *è* stato React (nodes[], edges[] in uno store, es.
Zustand) piuttosto che uno stato imperativo esterno da sincronizzare manualmente. React
Flow permette nodi custom con widget totalmente dinamici renderizzati da schema
`/object_info`, requisito esplicito di §11.

## 3. Backend/Bridge: Python + FastAPI

**Decisione:** **Python 3.11 + FastAPI** (async), Uvicorn come server ASGI.

**Alternative valutate:**
- *Node.js/Express o Fastify* — stesso linguaggio del frontend (vantaggio DX), ma:
  - ComfyUI stesso è scritto in Python e il suo ecosistema (parsing `.safetensors`,
    lettura metadata PNG/EXIF ComfyUI, futuro possibile riuso di codice/tooling
    ComfyUI-adiacente, es. `safetensors`, `Pillow`, VLM locali via `transformers`/`llama.cpp`
    bindings) è nativamente Python. Il Bridge finirà per fare parsing binario di file
    modello e immagini — dominio dove Python ha librerie mature e dirette.
  - Il target primario è un utente che ha già Python installato per far girare ComfyUI
    stesso: distribuire un Bridge Python riduce l'attrito ("un altro runtime da installare")
    rispetto a richiedere anche Node lato server (Node resta necessario solo in dev per
    buildare il frontend, non per eseguirlo in produzione: la build Vite è statica).
- *Go* — ottime performance/concorrenza e binario singolo per il packaging, ma ecosistema
  di parsing ML-metadata/immagini più povero e nessun vantaggio per l'integrazione
  ComfyUI-adiacente descritta sopra.

**Perché FastAPI:** tipizzazione via Pydantic (contratti API tipizzati, §32), supporto
nativo async per chiamate HTTP/WS verso ComfyUI senza bloccare, generazione automatica di
schema OpenAPI (utile per `packages/shared-types`), supporto WebSocket nativo (§33).

## 4. Database: SQLite (via SQLAlchemy 2.0 + Alembic)

**Decisione:** SQLite come da spec, acceduto tramite SQLAlchemy ORM 2.0 (stile async) con
migrazioni Alembic fin dalla Fase 1 (anche se lo schema iniziale è minimo) per non dover
reinventare la gestione delle migrazioni quando lo schema crescerà nelle fasi successive.

**Perché non un DB più "pesante":** uso monoutente locale, nessun bisogno di un server DB
separato, file singolo facile da includere nei backup (§28) e nell'export diagnostico
(§25). SQLite supporta bene le entità elencate in §24; se in futuro servisse
concorrenza multi-processo pesante si potrà rivalutare, ma non è un requisito attuale.

**Immagini/reference:** salvate su filesystem (`data/storage/characters/<id>/...`,
`data/storage/outputs/...`), il DB conserva solo path relativi + metadata (§15, §24) — mai
base64 in colonne DB.

## 5. Realtime: WebSocket

**Decisione:** WebSocket nativo FastAPI (`/ws/events`) che espone all'UI un flusso di
eventi normalizzati (progress, queue, execution-node, completion, error, bridge-status),
alimentato internamente da un client che si collega al WebSocket reale di ComfyUI
(`/ws?clientId=...`) e lo traduce/rilancia. Questo disaccoppia l'UI dal protocollo WS
specifico di ComfyUI (che può cambiare tra versioni) e permette al Bridge di aggiungere
eventi propri (es. `bridge_status_changed`) che ComfyUI non emette.

## 6. Comunicazione Bridge ↔ ComfyUI

**Decisione:** client HTTP asincrono con `httpx.AsyncClient`, timeout configurabili,
retry limitato con backoff sui soli errori di rete transitori (mai su errori applicativi).
Documentazione completa degli endpoint usati in `docs/comfyui-api.md`.

## 7. Packaging (visione, non Fase 1)

**Decisione per ora:** l'app gira come **web-app locale** (Bridge FastAPI serve anche i
file statici del build Vite in produzione) raggiungibile da `http://127.0.0.1:<porta>` —
soddisfa "UI web/desktop a schermo pieno" (il browser in modalità app/kiosk o finestra
massimizzata) e "futuro accesso LAN/tablet" (basta esporre il bind host) senza alcun
lavoro aggiuntivo, perché è semplicemente HTTP.

**Percorso futuro per il packaging desktop "vero" (Fase 11):** **Tauri**, non Electron:
- Tauri impacchetta lo stesso frontend Vite/React già scritto, usa WebView2 su Windows
  (già presente su Windows 10/11 moderni) invece di un runtime Chromium bundlato →
  eseguibile molto più leggero di Electron;
  il Bridge Python continuerebbe a girare come sidecar process locale (pattern supportato
  da Tauri) o, in alternativa, resterebbe un servizio locale avviato dal launcher `.bat`.
- Decisione rimandata a Fase 11 perché non blocca nessuna fase precedente e perché
  scegliere ora un tool di packaging specifico senza aver validato l'app reale sarebbe
  esattamente il tipo di "decisione alla cieca" che la spec vieta (§30).

**Launcher Windows (Fase 1, testuale/sintattico ma non eseguibile in questo ambiente
Linux):** `scripts/START_COMFY_DIRECTOR.bat` crea/attiva un venv, installa le dipendenze
Python, builda/serve il frontend, avvia Uvicorn e apre il browser. Va validato su Windows
reale dall'utente (dichiarato esplicitamente in AUDIT.md, rischio 5).

## 8. Struttura repository

Adottata la struttura di §31 quasi identica, con l'aggiunta di `packages/workflow-core`
e `packages/compatibility-engine` come pacchetti **Python** (vivono dentro
`apps/bridge/bridge/` come moduli interni nella Fase 1-4, per evitare l'overhead di un
mono-repo multi-package Python prematuro; verranno estratti come pacchetti installabili
separati solo se/quando la loro API si stabilizza — decisione YAGNI esplicita, rivedibile).
`packages/shared-types` contiene invece i tipi **TypeScript** condivisi dal frontend,
generati/derivati dagli schemi Pydantic del Bridge (OpenAPI) per evitare doppia
manutenzione manuale dei contratti.

```
comfy-director/
  apps/
    bridge/            # FastAPI, Python — Bridge, DB, engines, API
    frontend/          # React + TS + Vite
  packages/
    shared-types/       # tipi TS derivati dall'OpenAPI del Bridge
  data/                 # runtime: sqlite db, storage immagini (gitignored)
  docs/                 # spec, ADR aggiuntivi, design dei singoli engine
  scripts/              # launcher Windows/dev
  tests/                # test end-to-end trasversali (Fase successive)
  README.md
  AUDIT.md
  ARCHITECTURE_DECISION.md
  IMPLEMENTATION_PLAN.md
  CHANGELOG.md
```

## 9. Confini dei moduli interni al Bridge (Python)

```
apps/bridge/bridge/
  main.py                 # app FastAPI, mount router, startup/shutdown
  config.py                # Settings (pydantic-settings), .env
  logging_config.py        # logging strutturato JSON, redazione segreti
  db.py                    # engine SQLAlchemy async + session factory
  models.py                 # ORM models (§24)
  schemas.py                 # Pydantic request/response (contratti API tipizzati)
  routers/
    health.py               # GET /health
    comfy.py                 # GET /comfy/status, POST /comfy/sync, WS /ws/events
    settings.py               # GET/PUT /settings
    (routers futuri: inventory.py, compatibility.py, workflow.py, characters.py,
     prompt.py, ai.py — aggiunti nelle fasi corrispondenti)
  comfy_client/
    client.py                # ComfyClient: parla l'HTTP/WS reale di ComfyUI
    exceptions.py             # eccezioni tipizzate (Unreachable, Timeout, ...)
  inventory/                 # Fase 2
  compatibility/              # Fase 4
  workflow_intelligence/       # Fase 5
  ai_assistant/                # Fase 10
```

Ogni engine (Compatibility, Workflow Intelligence, AI Assistant) è un modulo Python
separato con la propria API interna (funzioni/classi pure, testabili senza FastAPI in
mezzo) — i router HTTP sono solo un adattatore sottile sopra questi moduli. Questo
rispetta la regola 4 (separazione netta) permettendo anche di testare gli engine in
isolamento (unit test puri, senza dover avviare un server).

## 10. Sicurezza credenziali AI/API

Le API key (OpenAI/Anthropic/altri, §20) sono salvate cifrate a riposo nella tabella
`ai_providers` (cifratura simmetrica con chiave derivata da una master key locale
generata al primo avvio e salvata fuori dal repo, in `data/`, mai committata — `data/` è
in `.gitignore`), mai loggate (il logger applica una redazione esplicita su chiavi note:
`api_key`, `authorization`, `token`, `secret`), mai hardcoded. Dettagli implementativi in
Fase 10 (il campo esiste nello schema DB fin da ora, §24, ma il flusso di cifratura reale
va costruito insieme al primo provider realmente collegato, per evitare crittografia
"finta" non testata).
