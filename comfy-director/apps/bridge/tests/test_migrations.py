"""Verifica che le migrazioni Alembic siano reali (non un create_all travestito):
applicarle da zero su un DB nuovo deve produrre esattamente le tabelle attese."""

from __future__ import annotations

import sqlite3

import bridge.config as config_module
from bridge.main import run_migrations


def test_alembic_migrations_create_expected_tables(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("COMFY_DIRECTOR_DATA_DIR", str(tmp_path))
    config_module._settings = None  # forza ricostruzione con il nuovo env

    try:
        run_migrations()

        db_path = tmp_path / "comfy_director.sqlite3"
        assert db_path.exists()

        conn = sqlite3.connect(db_path)
        try:
            tables = {
                row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
        finally:
            conn.close()

        assert {"settings", "comfy_instances", "errors", "alembic_version"} <= tables
    finally:
        config_module._settings = None  # non lasciare stato globale sporco per altri test


async def test_run_migrations_works_inside_a_running_event_loop(tmp_path, monkeypatch) -> None:
    """Regressione: `uvicorn --reload` importa `bridge.main` (che chiama
    `run_migrations()` a livello di modulo) da DENTRO il proprio event loop, a
    differenza dell'avvio senza reload. Riproduce esattamente quella condizione
    chiamando `run_migrations()` da un test async (quindi con un loop già in corso)."""
    monkeypatch.setenv("COMFY_DIRECTOR_DATA_DIR", str(tmp_path))
    config_module._settings = None

    try:
        run_migrations()  # non deve sollevare RuntimeError("... running event loop")

        db_path = tmp_path / "comfy_director.sqlite3"
        assert db_path.exists()
    finally:
        config_module._settings = None
