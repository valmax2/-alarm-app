"""Modelli ORM (SQLAlchemy 2.0).

Fase 1: solo le tabelle usate dalla fondazione (`settings`, `comfy_instances`,
`errors`). Le restanti tabelle di docs/data-model.md vengono aggiunte nelle fasi che le
usano, ciascuna con la propria migrazione Alembic — niente schema morto non testato.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class SettingRecord(Base):
    """Coppie chiave/valore di configurazione applicativa (docs/data-model.md #settings)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    value: Mapped[str] = mapped_column(Text)  # JSON-encoded
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ComfyInstanceRecord(Base):
    """Configurazione di connessione a un'istanza ComfyUI (docs/data-model.md #comfy_instances)."""

    __tablename__ = "comfy_instances"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(255))
    base_url: Mapped[str] = mapped_column(String(500))
    root_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    models_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    custom_nodes_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    workflow_dirs: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    is_default: Mapped[bool] = mapped_column(default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ErrorLogRecord(Base):
    """Errori applicativi persistiti per la Diagnostica (docs/data-model.md #errors)."""

    __tablename__ = "errors"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    level: Mapped[str] = mapped_column(String(16))
    source: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    context_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
