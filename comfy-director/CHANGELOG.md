# CHANGELOG — Comfy Director

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
