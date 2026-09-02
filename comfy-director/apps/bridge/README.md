# Comfy Director Bridge

Backend FastAPI locale che parla con ComfyUI e con la persistenza di Comfy Director.
Vedi `../../ARCHITECTURE_DECISION.md` per le motivazioni dello stack e
`../../docs/module-boundaries.md` per i confini interni.

## Avvio (sviluppo)

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env              # personalizzabile, vedi commenti nel file
uvicorn bridge.main:app --reload --host 127.0.0.1 --port 8787
```

Al primo avvio le migrazioni Alembic vengono applicate automaticamente (schema in
`migrations/versions/`). Il DB SQLite viene creato in `../../data/comfy_director.sqlite3`.

## Test

```bash
pytest        # suite completa, mock del trasporto HTTP — nessun ComfyUI richiesto
ruff check .  # lint
```

## Verifica manuale contro un ComfyUI reale

Nessuna istanza ComfyUI è disponibile nell'ambiente in cui questo Bridge è stato
sviluppato (vedi `../../AUDIT.md`). Prima di considerare affidabile una modifica al
Bridge, verificare manualmente contro un'istanza ComfyUI reale:

1. Avviare ComfyUI localmente (default `http://127.0.0.1:8188`).
2. Avviare il Bridge (`uvicorn bridge.main:app --reload`).
3. `curl http://127.0.0.1:8787/comfy/status` → deve riportare `"status": "online"` con
   la versione reale di ComfyUI.
4. Spegnere ComfyUI, ripetere la chiamata → deve tornare `"status": "offline"` con un
   `reason` leggibile, senza che il Bridge stesso vada in errore.
5. `curl -X POST http://127.0.0.1:8787/comfy/sync` con ComfyUI acceso → deve riportare
   conteggi nodi/modelli che corrispondono esattamente a quelli reali. Impostando anche
   `comfy_root_path` (via `PUT /settings`) verso la cartella ComfyUI/models reale, la
   sync deve arricchire i modelli `.safetensors` con family detection da header
   (`detection_source: "metadata"`) e funzionare anche a ComfyUI spento.
6. Con una vera API key Anthropic o OpenAI: creare un provider
   (`POST /ai-providers`) e chiamare `POST /prompt-from-image/analyze` con
   un'immagine reale → deve restituire un prompt strutturato coerente (non solo un
   errore). Già verificato in sviluppo che la richiesta raggiunge davvero
   `api.anthropic.com`/`api.openai.com` e che gli errori (es. chiave non valida) sono
   propagati correttamente — manca solo una chiave reale per la verifica positiva
   completa.
7. Creare un workflow (`POST /workflows`), aprirlo nella canvas frontend, aggiungere
   nodi reali via la ricerca (letti da `/inventory/nodes`), modificare un widget e
   salvare (`PUT /workflows/{id}`) → la versione deve incrementare e
   `GET /workflows/{id}` deve restituire il valore modificato, indipendentemente dalla
   UI. Già verificato in sviluppo con un ComfyUI simulato (l'ambiente non ne ha uno
   reale, vedi sopra).
8. Con un workflow valido aperto, premere GENERA nella barra superiore → deve passare
   da "In coda" a "In esecuzione" a "Completata" con una miniatura reale dell'output,
   e `GET /generations/{id}` deve corrispondere a quanto mostra la UI. ABORT durante
   l'esecuzione deve fermare davvero il job su ComfyUI (verificare che scompaia da
   `GET /queue`) e marcare la generazione "Interrotta". Già verificato in sviluppo con
   un ComfyUI simulato (l'ambiente non ne ha uno reale, vedi sopra) — inclusi
   `POST /prompt`, `GET /queue`, `GET /history/{id}`, `POST /interrupt`, `GET /view`.
9. Con un provider AI configurato, aprire "Assistente AI" e scrivere un messaggio →
   deve arrivare una risposta reale (non un placeholder) e la cronologia deve
   sopravvivere a un refresh (`GET /chat/messages`). Con una chiave non valida,
   l'errore reale del provider deve comparire in UI, e il messaggio dell'utente deve
   restare in cronologia (non deve doverlo riscrivere). Già verificato in sviluppo con
   una chiamata reale (non mockata) verso `api.anthropic.com` con una chiave non
   valida — manca solo una chiave reale per la verifica positiva completa (stessa
   situazione di "Prompt da Immagine", punto 6).

## Migrazioni

```bash
alembic revision -m "descrizione" --autogenerate   # dopo aver modificato bridge/models.py
alembic upgrade head
```

## Struttura

```
bridge/
  main.py               # entry point FastAPI (vedi build_app/create_app)
  config.py               # Settings (pydantic-settings, .env)
  logging_config.py        # log JSON strutturato + redazione segreti
  db.py                     # engine SQLAlchemy async
  models.py                  # ORM (settings, comfy_instances, errors, nodes,
                              # node_schemas, models, model_metadata, ai_providers,
                              # workflows, workflow_versions, generations, chat_messages)
  schemas.py                   # contratti API (Pydantic)
  deps.py                       # dependency injection FastAPI
  comfy_instance.py               # gestione riga "default" di comfy_instances
  comfy_client/                     # unico punto di contatto HTTP con ComfyUI
                                     # (Fase 6: + queue_prompt/get_queue/get_history/
                                     # interrupt/get_view_bytes)
  inventory/                         # Fase 2: sync (/object_info + filesystem),
                                      # family detection, node_registry, safetensors
  compatibility/                       # Fase 4 v1: resolve() + filter_models_by_family
  workflow/                             # Fase 3: modello grafo + validate_structure();
                                         # Fase 6: compile_to_comfy_payload()
  media/                                 # Fase 8: parser chunk PNG (tEXt/zTXt/iTXt)
  workflow_import/                        # Fase 8: workflow da immagine; Fase 5:
                                           # workflow da file .json standalone
  ai_providers/                            # Fase 9: CRUD provider, cifratura, vision;
                                            # Fase 10: chat (send_chat_message)
  routers/                                  # health, comfy, settings, inventory,
                                             # workflows, workflow_import, ai_providers,
                                             # prompt_from_image, generations, chat
migrations/                                  # Alembic
tests/                                        # pytest (mock respx, nessuna rete reale
                                               # verso ComfyUI; alcune verifiche manuali
                                               # in sviluppo hanno raggiunto davvero
                                               # l'API Anthropic reale, vedi sopra)
```
