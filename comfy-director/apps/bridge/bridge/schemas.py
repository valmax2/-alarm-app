"""Contratti API tipizzati (Pydantic) — spec §32.

Questi modelli sono la fonte da cui `packages/shared-types` deriva i tipi TypeScript
(via lo schema OpenAPI generato automaticamente da FastAPI su /openapi.json), per non
mantenere manualmente due copie dei contratti.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    time: datetime


class ComfyStatusResponse(BaseModel):
    status: Literal["online", "offline"]
    reason: str | None = Field(
        default=None,
        description="Motivo leggibile quando status='offline' (es. 'non raggiungibile', 'timeout').",
    )
    base_url: str
    version: str | None = None
    os: str | None = None
    python_version: str | None = None
    pytorch_version: str | None = None
    checked_at: datetime


class SettingsResponse(BaseModel):
    comfy_base_url: str


class SettingsUpdateRequest(BaseModel):
    comfy_base_url: str
