# Comfy Director

Un livello di gestione intelligente sopra **ComfyUI locale**: comprensione,
compatibilità, costruzione guidata dei workflow, personaggi, prompt e assistenza AI —
mantenendo ComfyUI come motore di esecuzione. Vedi `docs/COMFY_DIRECTOR_SPEC.md` per la
specifica completa, `AUDIT.md`/`ARCHITECTURE_DECISION.md`/`IMPLEMENTATION_PLAN.md` per
il ragionamento e la roadmap.

**Stato attuale: Fase 1 (Fondazione) + Fase 2 (Inventario reale) + Fase 3 (Canvas
reale) + Fase 4 v1 (filtro per famiglia) + Fase 8 parziale (Workflow da Immagine) +
Fase 9 parziale (Prompt da Immagine).** Bridge FastAPI reale (health/status/settings/
sync/inventory/workflows/workflow-import/ai-providers/prompt-from-image), lettura
reale di nodi e modelli da ComfyUI (`/object_info`) e/o direttamente dal filesystem
(percorso ComfyUI configurabile, funziona anche a ComfyUI spento), filtro modelli per
famiglia con motivo di compatibilità sempre visibile, estrazione reale del workflow
incorporato nelle immagini PNG di ComfyUI, analisi immagine→prompt strutturato tramite
provider AI cloud (Anthropic/OpenAI, chiave dell'utente). Frontend React con canvas
reale a nodi (React Flow: nodi/archi/widget/porte letti dallo schema reale ComfyUI,
pannello proprietà, undo/redo, persistenza versionata sul Bridge) e pannelli
Bridge/Modelli/Nodi/Workflow/Workflow-da-Immagine/Prompt-da-Immagine reali (pulsanti
dei flussi sulla barra sinistra). Tutto il resto (workflow intelligence/compatibility
engine completo, personaggi, generazione, AI assistant chat, ...) è dichiarato
esplicitamente come non ancora disponibile nella UI stessa — vedi
`IMPLEMENTATION_PLAN.md` per le fasi successive e per i dettagli su cosa della Fase 3
è deliberatamente semplificato (es. undo/redo snapshot-based, niente auto-layout).

## Avvio rapido

**Windows (utente finale):** doppio click su `scripts\START_COMFY_DIRECTOR.bat` —
builda il frontend, prepara il Bridge Python e apre `http://127.0.0.1:8787` nel
browser. Richiede Python 3.11+ e Node.js 20+ installati.

**Sviluppo (Windows/Linux/macOS):**
- Windows: `scripts\START_BRIDGE.bat` (solo Bridge, dev con reload) + `npm run dev` in
  `apps/frontend` (frontend con hot-reload su `:5173`).
- Linux/macOS: `scripts/dev.sh` avvia entrambi in parallelo (Bridge su `:8787` con
  `--reload`, frontend Vite su `:5173`).

Il Bridge propone `http://127.0.0.1:8188` come URL ComfyUI di default (modificabile
dalla UI, sezione "Bridge ComfyUI"): apri quella sezione, verifica/correggi l'URL, lo
stato in alto a destra mostrerà ONLINE/OFFLINE in base alla risposta reale di ComfyUI.

## Struttura

```
comfy-director/
  apps/
    bridge/      # backend Python/FastAPI — vedi apps/bridge/README.md
    frontend/    # React + TypeScript + Vite
  packages/
    shared-types/ # tipi TS condivisi (popolati a partire dalla Fase 2+)
  data/          # runtime: DB SQLite, storage, log — mai committato (vedi .gitignore)
  docs/          # specifica, modello dati, design dei singoli engine, piano di test
  scripts/       # launcher Windows (.bat) e script di sviluppo (dev.sh)
  AUDIT.md
  ARCHITECTURE_DECISION.md
  IMPLEMENTATION_PLAN.md
  CHANGELOG.md
```

## Test

```bash
# Bridge
cd apps/bridge && python -m venv .venv && source .venv/bin/activate  # o .venv\Scripts\activate su Windows
pip install -e ".[dev]"
pytest

# Frontend
cd apps/frontend && npm install
npm test
npm run build
```

Nessuna istanza ComfyUI è richiesta per la suite di test (mock del trasporto HTTP —
vedi `AUDIT.md` per il perché e `docs/test-plan.md` per il dettaglio). La verifica
contro un'istanza ComfyUI reale resta un passo manuale, documentato in
`apps/bridge/README.md`.

## Documenti di riferimento

| Documento | Contenuto |
|---|---|
| `docs/COMFY_DIRECTOR_SPEC.md` | Specifica originale ricevuta, integrale |
| `AUDIT.md` | Riassunto requisiti, rischi/ambiguità, audit dell'ambiente di sviluppo |
| `ARCHITECTURE_DECISION.md` | Stack scelto e motivazioni/trade-off |
| `IMPLEMENTATION_PLAN.md` | Roadmap a fasi (0-11) con Definition of Done |
| `docs/data-model.md` | Schema DB completo |
| `docs/module-boundaries.md` | Confini e API interna di ciascun modulo |
| `docs/comfyui-api.md` | Endpoint ComfyUI usati dal Bridge |
| `docs/compatibility-engine.md` | Design del Compatibility Engine |
| `docs/workflow-intelligence-engine.md` | Design del Workflow Intelligence Engine |
| `docs/test-plan.md` | Piano di test per ogni modulo/fase |
