# Comfy Director

Un livello di gestione intelligente sopra **ComfyUI locale**: comprensione,
compatibilità, costruzione guidata dei workflow, personaggi, prompt e assistenza AI —
mantenendo ComfyUI come motore di esecuzione. Vedi `docs/COMFY_DIRECTOR_SPEC.md` per la
specifica completa, `AUDIT.md`/`ARCHITECTURE_DECISION.md`/`IMPLEMENTATION_PLAN.md` per
il ragionamento e la roadmap.

**Stato attuale: Fase 1 (Fondazione) + Fase 2 (Inventario reale) + Fase 3 (Canvas
reale) + Fase 4 v1 (filtro per famiglia) + Fase 5 v1 (scelta famiglia + import
workflow JSON) + Fase 6 v2 (generazione reale via ComfyUI, con relay WebSocket per il
progresso live) + Fase 7 v2 (libreria Personaggi + export/import Character Pack) +
Fase 8 parziale (Workflow da Immagine) + Fase 9 (Prompt da Immagine + Prompt Engine
con traduzione IT→EN + preset riutilizzabili + Smart Prompt Compiler con Coerenza
Personaggio + selettore acconciature con anteprime + Body Director (zone del corpo)
+ Camera Director (5 slider) + invio diretto del prompt a un nodo del workflow) +
Fase
10 v1 (chat reale con l'Assistente AI) + Fase 11 v1 (diagnostica reale: errori non
gestiti persistiti + report).**
Bridge FastAPI reale (health/status/settings/sync/inventory/workflows/workflow-import/
ai-providers/prompt-from-image/prompts/generazione/chat/characters/diagnostics),
lettura reale di nodi e modelli da ComfyUI (`/object_info`) e/o direttamente dal
filesystem (percorso ComfyUI configurabile, funziona anche a ComfyUI spento), filtro
modelli per famiglia con motivo di compatibilità sempre visibile, estrazione reale
del workflow incorporato nelle immagini PNG di ComfyUI (e ora anche da un file
`.json` standalone esportato da ComfyUI), analisi immagine→prompt strutturato
tramite provider AI cloud (Anthropic/OpenAI, chiave dell'utente), **traduzione reale
IT→EN** per un prompt scritto a mano (con blocco traduzione e cronologia),
**generazione reale attraverso ComfyUI** (compila il grafo nel payload API, mette in
coda, aggiorna lo stato per polling, recupera e mostra l'immagine risultante, ABORT
reale — più una relay WebSocket per il progresso live: nodo in esecuzione evidenziato
sulla canvas, percentuale reale, con degradazione automatica al solo polling se il WS
non è disponibile), **chat reale con l'Assistente AI** (stesso provider configurato,
senza ancora poter leggere/modificare il workflow), **libreria Personaggi** (CRUD +
immagini reali su filesystem, export/import come Character Pack .zip, non ancora
collegata alla generazione),
**diagnostica reale** (ogni eccezione non gestita nel Bridge viene catturata da un
exception handler globale, persistita con messaggio/contesto redatti — mai in
chiaro — e consultabile/esportabile dalla UI, invece di sparire in un 500 anonimo).
Frontend React con canvas reale a nodi (React Flow: nodi/archi/widget/porte letti
dallo schema reale ComfyUI, pannello proprietà, undo/redo, persistenza versionata sul
Bridge), creazione workflow con scelta famiglia, bottoni GENERA/ABORT reali e
pannelli Bridge/Modelli/Nodi/Workflow/Workflow-da-Immagine/Prompt-da-Immagine/
Prompt-Engine/Assistente-AI/Personaggi/Diagnostica reali (pulsanti dei flussi sulla
barra sinistra). Tutto il resto (workflow intelligence/compatibility engine completo,
AI Tool Layer, ...) è dichiarato esplicitamente come non ancora disponibile nella UI
stessa — vedi `IMPLEMENTATION_PLAN.md` per le fasi successive e per i dettagli su
cosa è deliberatamente semplificato (es. Fase 3: undo/redo snapshot-based, niente
auto-layout; Fase 5: la famiglia è per ora solo un'etichetta, nessuna generazione
automatica di nodi; Fase 6: la relay WebSocket copre solo nodo-in-esecuzione e
percentuale (v2), nessuna live-preview delle immagini durante il sampling;
Fase 7: personaggi non ancora collegati alla generazione, nessun drag&drop nella
canvas; Fase 9: il prompt composto può essere inviato direttamente a un nodo del workflow
("Invia al workflow", individuazione strutturale mai indovinata), gli attributi del
corpo si navigano per zone (Body Director) invece di un elenco piatto di menu, e la
camera ha anche un controllo a 5 slider (Camera Director, sostituisce del tutto i
menu Taglio/Angolo/Lens quando attivo) oltre ai cataloghi, ma non è ancora collegato
a `prompts.generation_id` né a un percorso "componi → invia → genera" in un solo
click; Fase 10: nessun AI
Tool Layer, l'assistente non legge né modifica il
workflow; Fase 11: la diagnostica v1 cattura solo le eccezioni non gestite, non un
log strutturato di ogni richiesta né alert/metriche — backup/versioning completi,
suite di test estesa e packaging desktop restano da fare).

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
