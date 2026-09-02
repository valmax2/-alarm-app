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

## Migrazioni

```bash
alembic revision -m "descrizione" --autogenerate   # dopo aver modificato bridge/models.py
alembic upgrade head
```

## Struttura

```
bridge/
  main.py             # entry point FastAPI (vedi build_app/create_app)
  config.py             # Settings (pydantic-settings, .env)
  logging_config.py      # log JSON strutturato + redazione segreti
  db.py                   # engine SQLAlchemy async
  models.py                # ORM (Fase 1: settings, comfy_instances, errors)
  schemas.py                 # contratti API (Pydantic)
  deps.py                     # dependency injection FastAPI
  comfy_client/                 # unico punto di contatto HTTP con ComfyUI
  routers/                       # health, comfy, settings (adattatori HTTP sottili)
migrations/                        # Alembic
tests/                              # pytest (mock respx, nessuna rete reale)
```
