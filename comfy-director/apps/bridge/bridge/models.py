"""Modelli ORM (SQLAlchemy 2.0).

Fase 1: `settings`, `comfy_instances`, `errors`.
Fase 2: `nodes`, `node_schemas`, `models`, `model_metadata` (Inventory Engine).
Fase 9 (Prompt da Immagine, portata avanti su richiesta esplicita): `ai_providers`.
Le restanti tabelle di docs/data-model.md vengono aggiunte nelle fasi che le usano,
ciascuna con la propria migrazione Alembic — niente schema morto non testato.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
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


class NodeRecord(Base):
    """Nodo realmente registrato nell'istanza ComfyUI collegata (docs/data-model.md #nodes)."""

    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(String(600), primary_key=True)  # f"{instance_id}:{class_type}"
    comfy_instance_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("comfy_instances.id", ondelete="CASCADE")
    )
    class_type: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(255))
    is_custom_node: Mapped[bool] = mapped_column(Boolean, default=False)
    source_extension: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class NodeSchemaRecord(Base):
    """Schema /object_info grezzo + normalizzato per un nodo (docs/data-model.md #node_schemas)."""

    __tablename__ = "node_schemas"

    node_id: Mapped[str] = mapped_column(
        String(600), ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True
    )
    raw_schema: Mapped[str] = mapped_column(Text)  # JSON: risposta grezza /object_info/{class_type}
    input_summary: Mapped[str] = mapped_column(Text)  # JSON normalizzato (vedi inventory/sync.py)
    output_summary: Mapped[str] = mapped_column(Text)  # JSON normalizzato
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ModelRecord(Base):
    """Elemento di inventario: checkpoint, LoRA, VAE, ControlNet, ecc. (docs/data-model.md #models)."""

    __tablename__ = "models"

    id: Mapped[str] = mapped_column(String(600), primary_key=True)
    comfy_instance_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("comfy_instances.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(500))
    path: Mapped[str] = mapped_column(String(1000))  # path/nome così come riportato da ComfyUI
    model_type: Mapped[str] = mapped_column(String(64))
    extension: Mapped[str] = mapped_column(String(32))
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    family: Mapped[str | None] = mapped_column(String(64), nullable=True)
    architecture: Mapped[str | None] = mapped_column(String(128), nullable=True)
    detection_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    detection_source: Mapped[str] = mapped_column(String(64), default="internal_rule")
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ModelMetadataRecord(Base):
    """Metadata grezzi estratti per un modello, quando disponibili (docs/data-model.md #model_metadata)."""

    __tablename__ = "model_metadata"

    model_id: Mapped[str] = mapped_column(
        String(600), ForeignKey("models.id", ondelete="CASCADE"), primary_key=True
    )
    raw_header: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON header .safetensors
    extra: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON


class AIProviderRecord(Base):
    """Provider AI configurato dall'utente per l'analisi immagine (spec §9, §20).

    La chiave API è cifrata a riposo (`bridge.ai_providers.crypto`) — la colonna
    contiene il ciphertext, mai la chiave in chiaro. Nessuna riga qui è mai creata
    automaticamente: solo l'utente, esplicitamente, tramite `/ai-providers`.
    """

    __tablename__ = "ai_providers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    kind: Mapped[str] = mapped_column(String(32))  # "anthropic" | "openai" | "local"
    label: Mapped[str] = mapped_column(String(255))
    encrypted_api_key: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
