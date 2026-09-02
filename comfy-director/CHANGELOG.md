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
