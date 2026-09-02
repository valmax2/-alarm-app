"""Gestione della istanza ComfyUI configurata.

Fase 1-2: una sola istanza supportata, con id fisso "default" — lo schema DB supporta
multi-istanza fin dalla Fase 1 (`comfy_instances`), ma UI e flusso attuali ne gestiscono
una sola; estendibile senza nuove migrazioni quando servirà (spec §3).

Questo è l'UNICO posto che crea/legge la riga "default" di `comfy_instances`: sia le
Impostazioni (base_url, percorso ComfyUI) sia la sincronizzazione inventario passano da
qui, per avere una sola fonte di verità sulla configurazione di connessione.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from bridge.models import ComfyInstanceRecord

DEFAULT_INSTANCE_ID = "default"


async def get_or_create_default_instance(session: AsyncSession, default_base_url: str) -> ComfyInstanceRecord:
    instance = await session.get(ComfyInstanceRecord, DEFAULT_INSTANCE_ID)
    if instance is None:
        instance = ComfyInstanceRecord(
            id=DEFAULT_INSTANCE_ID, name="Locale", base_url=default_base_url, is_default=True
        )
        session.add(instance)
        await session.flush()
    return instance
