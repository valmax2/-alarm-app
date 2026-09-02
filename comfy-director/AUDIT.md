# AUDIT — Comfy Director

Data: 2026-09-02
Autore: Claude Code (sessione di sviluppo remota)

Questo documento è la **Fase 0** richiesta dalla specifica (`docs/COMFY_DIRECTOR_SPEC.md`
— il testo integrale ricevuto è riportato lì per riferimento). Riassume i requisiti senza
eliminarne nessuno, elenca rischi/ambiguità, e registra l'audit dell'ambiente reale in cui
questo codice viene scritto.

---

## 1. Riassunto dei requisiti (nessuno eliminato)

### 1.1 Visione
Comfy Director è un livello di gestione intelligente sopra ComfyUI locale. ComfyUI resta il
motore di generazione; Comfy Director fornisce comprensione, selezione, compatibilità,
costruzione guidata del workflow, organizzazione, diagnostica, libreria personaggi, prompt
engine e assistente AI, con una UX pulita a due modalità (semplice/avanzata).

### 1.2 Moduli obbligatori (separazione netta)
1. **UI** (canvas nera stile ComfyUI, pannelli contestuali, barra sinistra)
2. **Modello dati workflow interno** (source of truth, non la canvas)
3. **Comfy Bridge** (comunicazione reale con ComfyUI locale via HTTP/WS)
4. **Inventory Engine** (checkpoint, LoRA, VAE, CLIP, ControlNet, IPAdapter, InstantID,
   upscale models, embeddings, custom node, ecc. — con id/path/type/size/hash/family/
   architecture/metadata/confidence/source/last_seen)
5. **Compatibility Engine** (compatible/incompatible/unknown/warning + reason + source +
   confidence, multi-fonte, mai dichiarare compatibilità inventata)
6. **Workflow Intelligence Engine** (intenti → capability richieste → nodi reali disponibili
   → candidate workflow → validazione → canvas; niente liste hardcoded di nomi nodo)
7. **AI Assistant** (chat generica + Copilot con tool layer controllato, provider
   configurabili: locale/OpenAI/Anthropic, nessuna chiave hardcoded)
8. **Character Library** (libreria personaggi persistente, multi-reference, no base64-only)
9. **Prompt Engine** (IT→EN, provider locale/cloud, editing manuale, cronologia, preset)

### 1.3 Funzionalità applicative
- Sincronizzazione Bridge con report reale (versione, nodi, checkpoint, LoRA, ecc., MAI
  numeri inventati); launcher `.bat` per Windows.
- Inventory persistente con famiglie estensibili (FLUX, SD1.x, SDXL, WAN, Qwen, altre).
- Filtraggio per (tipo workflow × famiglia) basato su più fonti di compatibilità, non solo
  nome file.
- Import/analisi di workflow JSON esistenti, libreria workflow (duplica/rinomina/tag/
  cerca/valida/apri/variante).
- **Workflow da immagine** (estrazione metadata ComfyUI reali, mai inventati).
- **Prompt da immagine** (vision locale o cloud, prompt strutturato).
- Canvas node-graph reale, bidirezionale con il modello interno, widget dinamici derivati
  dallo schema reale dei nodi (`/object_info`), pannello proprietà contestuale.
- UI principale: barra sinistra con pulsanti (Tipo Flusso, Motore AI, Personaggi, Workflow,
  Workflow da Immagine, Prompt da Immagine, Modelli, Nodi, Bridge, Assistente AI,
  Impostazioni), canvas centrale, pannello destro contestuale, barra inferiore (prompt/
  output/progress/log).
- Tipo di flusso (Coerenza Personaggio prioritaria, T2I, I2I, I2V, T2V, Inpainting/Outpaint,
  estensibile).
- Scelta famiglia AI dopo il tipo di flusso → contesto di compatibilità propagato a tutta
  l'app.
- Libreria personaggi: CRUD, multi-immagine, drag&drop, import cloud, privacy toggle, tag,
  note, export/import, storage filesystem reale (non solo localStorage/base64).
- Flusso "Coerenza Personaggio" con multiple strategie derivate da capability reali.
- Generazione: validazione pre-generazione, compilazione verso formato API ComfyUI, invio,
  tracking coda/progress via WS, ricezione output, log, relazione output↔workflow, ABORT.
- Galleria output con metadata completi e ritorno al workflow sorgente.
- AI Assistant con tool layer strutturato (get_current_workflow, get_inventory, ecc.),
  anteprima/applica/annulla per modifiche, mai editing diretto non validato.
- Knowledge base locale che accumula regole/errori/combinazioni con provenienza e
  confidence (mai "ha funzionato una volta" = "compatibile sempre").
- Persistenza SQLite con schema esplicito (settings, comfy_instances, nodes, node_schemas,
  models, model_metadata, compatibility_rules, workflows, workflow_versions, characters,
  character_images, generations, prompts, errors, ai_providers).
- Diagnostica con export report (redigendo segreti).
- Validatore workflow con messaggi azionabili (non solo "Error").
- Import/export multipli senza distruggere l'originale; backup/versioning workflow e
  progetto.
- Privacy: reference locali restano locali salvo scelta esplicita, indicazione chiara di
  invii cloud, API key protette, log senza segreti.
- Realtime via WebSocket per progress/queue/execution/error/bridge status, evidenziazione
  nodo in esecuzione sulla canvas.
- Performance: indicizzazione, cache, sync incrementale, virtualizzazione liste, lazy
  loading.
- Ricerca globale rispettosa dei filtri di compatibilità, con toggle "mostra incompatibili".
- Modalità Semplice/Avanzata senza perdita di potenza in avanzata.
- Sorgenti multiple per immagini (PC, drag&drop, Google Drive, futuro altro cloud) —
  integrazione reale, non `<input type=file>` spacciato per Drive.
- Test minimi per Bridge, Inventory, Compatibility, Workflow, Comfy compilation,
  Characters, Metadata import.
- Roadmap a fasi (0-11) — vietato costruire tutto in un colpo solo.
- Definition of Done generale per ogni feature (UI + backend + dati persistenti + error
  handling + test + stato reale + documentazione + non rompere il resto).
- Checklist finale della visione utente (§44 della spec) come criterio di accettazione.

---

## 2. Audit dell'ambiente reale (questa sessione di sviluppo)

Questo è **l'audit più importante e il primo rischio del progetto**: l'ambiente in cui
questo codice viene scritto **non è** il PC Windows dell'utente finale con ComfyUI
installato.

| Voce | Stato rilevato |
|---|---|
| OS | Linux (container remoto, Claude Code on the web), non Windows |
| ComfyUI locale raggiungibile | **NO** — nessuna istanza ComfyUI gira in questo ambiente |
| Filesystem con modelli/checkpoint reali | **NO** — nessuna cartella `models/`, `custom_nodes/` reale da leggere |
| Python | 3.11.15, `pip`/`uv`/`poetry` disponibili |
| Node.js | v22.22.2, `npm` 10.9.7 |
| Accesso rete (PyPI, npm registry) | OK (verificato) |
| GPU | Non rilevante in questa sessione (non serve per il Bridge) |
| Repository esistente | `alarm_app` — repo Flutter/Android con due progetti scorrelati
 (`FaceGuard`, `FortKnoxVault`, entrambi app Android di sicurezza/privacy). Nessun
 codice precedente relativo a ComfyUI. |

**Conseguenza diretta sulle regole non negoziabili (§0, regola 1 e 10):** in questa sessione
NON è possibile eseguire un test di integrazione reale end-to-end contro un'istanza vera di
ComfyUI (nessuna istanza disponibile). Il Bridge viene quindi costruito per parlare il
protocollo HTTP/WebSocket reale e documentato di ComfyUI (`docs/comfyui-api.md`), con:

- **unit test** che mockano il trasporto HTTP (nessuna chiamata di rete reale) per provare
  la logica del Bridge (parsing, stato online/offline, gestione errori/timeout);
- uno **stato dichiarato esplicitamente** in UI e diagnostica quando il Bridge non è
  connesso, mai una simulazione spacciata per dato reale (nessun numero di
  nodi/checkpoint inventato — se il Bridge è offline, l'inventario resta vuoto e lo dice);
  chi esegue l'app sul proprio PC Windows con ComfyUI acceso vedrà i dati reali.
- Il test di integrazione reale contro un'istanza ComfyUI locale è responsabilità
  dell'utente in fase di validazione locale (documentato in `README.md` del bridge) e va
  ripetuto ad ogni fase che tocca il Bridge.

Questo NON è una scorciatoia: è la dichiarazione onesta richiesta dalla regola 10
("se una parte non è ancora implementata/verificabile qui, dichiararlo chiaramente").

---

## 3. Rischi e ambiguità identificati

1. **Nessun ComfyUI reale disponibile in sviluppo.** Mitigazione: client HTTP/WS scritto
   contro le API pubbliche documentate di ComfyUI (`/system_stats`, `/object_info`,
   `/queue`, `/history`, `/prompt`, `/interrupt`, `/view`, `/ws`), test unitari con mock del
   trasporto, integrazione reale demandata a verifica locale dell'utente ad ogni fase.
2. **"Vision-language model locale" e "provider cloud" per Prompt-da-Immagine/AI
   Assistant**: non esiste un unico standard; l'astrazione provider deve essere costruita
   fin da subito ma le implementazioni concrete (es. un VLM locale specifico) sono rimandate
   a fasi successive (9-10) e dichiarate "non ancora implementate" finché non lo sono
   davvero — mai un pulsante che finge di funzionare.
3. **Google Drive / cloud storage**: richiede OAuth reale e credenziali utente; è
   esplicitamente vietato fingere con `<input type=file>`. Verrà progettata come sorgente
   pluggable (interfaccia `ImageSource`) ma l'implementazione OAuth reale è pianificata in
   una fase successiva alla Fase 1, e finché non c'è va mostrata come "non configurato".
4. **Riconoscimento famiglia modello (FLUX/SDXL/SD1.x/WAN/Qwen/...)**: non esiste
   un'API ComfyUI che restituisca direttamente la "famiglia". Verrà dedotta da più segnali
   (metadata safetensors, nome/namespace dei nodi in `/object_info`, euristiche
   versionate) con `confidence` esplicita — mai certezza finta.
5. **Packaging Windows / `.bat` launcher**: eseguibile solo a valle di un Bridge Python
   reale con dipendenze installabili (venv). In Fase 1 viene fornito uno script funzionante
   (crea venv, installa requirements, avvia uvicorn + build/preview frontend) ma il
   packaging "one-click" definitivo (Fase 11) richiede build su Windows, che questo
   ambiente Linux non può produrre nativamente (nessun cross-compile di eseguibili
   Windows nativi necessario però: sia il Bridge Python sia il frontend Vite sono
   cross-platform; lo script `.bat` è testo puro, quindi scrivibile e verificabile qui
   sintatticamente ma non eseguibile qui).
6. **Repository condiviso con progetti scorrelati** (`FaceGuard`, `FortKnoxVault`, Flutter
   `alarm_app`): Comfy Director viene isolato in `comfy-director/` per non toccare/rompere
   quei progetti (regola 6: "non rompere funzioni già funzionanti").
7. **Ampiezza della specifica**: costruire tutto insieme violerebbe la regola "non
   sostituire il progetto con una semplificazione arbitraria" tanto quanto "non tentare di
   costruire tutto in una singola modifica gigantesca". Questa consegna copre Fase 0
   (interamente) e Fase 1 (fondazione reale, testabile). Le fasi successive richiedono
   sessioni dedicate, ciascuna con il proprio DoD verificato prima di procedere (vedi
   `IMPLEMENTATION_PLAN.md`).

---

## 4. Cosa NON viene fatto in questa consegna (dichiarato esplicitamente)

Per rispettare la regola 10, questi punti della checklist finale (§44) NON sono ancora
implementati dopo questa consegna e non devono essere presentati come tali:

- Canvas node-graph reale (Fase 3)
- Compatibility Engine con regole popolate (Fase 4)
- Workflow builder / Coerenza Personaggio (Fase 5)
- Generazione reale via ComfyUI (Fase 6)
- Libreria personaggi (Fase 7)
- Import workflow/immagini con metadata (Fase 8)
- Prompt Engine IT→EN (Fase 9)
- AI Assistant (Fase 10)
- Diagnostica avanzata, backup/versioning, packaging Windows definitivo (Fase 11)

Questa consegna implementa **Fase 0** (audit/architettura/piano) e **Fase 1**
(fondazione: repo, frontend minimo, Bridge reale con health/status, DB, settings,
logging), con relativi test automatici reali.
