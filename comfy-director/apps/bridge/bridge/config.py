"""Configurazione del Bridge.

Nessun valore critico è hardcoded: tutto è sovrascrivibile via variabili d'ambiente o
file `.env` (vedi `.env.example`). L'URL di ComfyUI mostrato qui è solo il default del
*form* di configurazione iniziale — l'utente può cambiarlo dalla UI (persistito poi in
`settings`, non qui), coerente con la spec §3 ("Non assumere però percorsi fissi").
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Root del monorepo comfy-director (.../comfy-director), usata per posizionare `data/`
# in modo prevedibile indipendentemente dalla cwd da cui si avvia uvicorn.
_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="COMFY_DIRECTOR_", env_file=".env", extra="ignore")

    # --- Bridge server ---
    host: str = "127.0.0.1"
    port: int = 8787
    cors_allow_origins: list[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]

    # --- Persistenza ---
    data_dir: Path = _REPO_ROOT / "data"
    database_url: str | None = None  # se assente, derivato da data_dir (vedi db.py)

    # --- ComfyUI default (solo valore iniziale del form impostazioni) ---
    default_comfy_base_url: str = "http://127.0.0.1:8188"
    comfy_request_timeout_seconds: float = 5.0
    comfy_object_info_timeout_seconds: float = 20.0

    # --- Logging ---
    log_level: str = "INFO"

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / "comfy_director.sqlite3"

    @property
    def storage_dir(self) -> Path:
        return self.data_dir / "storage"

    @property
    def log_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def secret_key_path(self) -> Path:
        """Chiave locale per cifrare le credenziali dei provider AI a riposo (mai nel
        repository — vedi .gitignore — e mai nello stesso posto dei dati cifrati)."""
        return self.data_dir / "secret.key"

    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{self.sqlite_path}"


_settings: Settings | None = None


def get_settings() -> Settings:
    """Restituisce le settings applicative come singleton (cacheable, ma non globale
    mutabile "a sorpresa": i test possono creare Settings() proprie e passarle
    esplicitamente invece di dipendere da questo singleton)."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
