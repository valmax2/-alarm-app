"""Client HTTP verso ComfyUI.

Fase 1: `get_system_stats` (Bridge-status reale, §3 della spec).
Fase 2: `get_object_info` (schema completo di tutti i nodi registrati — fonte
dell'inventario nodi/modelli, §11 e Fase 2 del piano). Gli altri endpoint documentati
in `docs/comfyui-api.md` (`/queue`, `/history`, `/prompt`, `/interrupt`, `/view`,
WebSocket) vengono aggiunti in Fase 6 — aggiungerli ora senza un chiamante reale e senza
test significativi violerebbe la regola "non fingere funzionalità implementate".

Nessun altro modulo deve aprire connessioni dirette a ComfyUI: questo è l'unico punto di
contatto (vedi docs/module-boundaries.md).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from bridge.comfy_client.exceptions import (
    ComfyHTTPError,
    ComfyProtocolError,
    ComfyTimeout,
    ComfyUnreachable,
)


@dataclass(frozen=True)
class ComfySystemStats:
    """Vista normalizzata (e tollerante) della risposta di /system_stats.

    Ogni campo è opzionale: se ComfyUI non lo espone (versione diversa, campo mancante),
    resta `None` piuttosto che sollevare un errore di parsing — coerente con
    "nessuna assunzione di versione" in docs/comfyui-api.md.
    """

    version: str | None
    os: str | None
    python_version: str | None
    pytorch_version: str | None
    raw: dict


class ComfyClient:
    def __init__(self, base_url: str, timeout_seconds: float = 5.0):
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    async def _get_json(self, path: str, timeout_seconds: float | None = None) -> Any:
        """GET generico con la gestione errori condivisa da tutte le chiamate.

        Solleva `ComfyUnreachable`, `ComfyTimeout`, `ComfyHTTPError` o
        `ComfyProtocolError` — mai un'eccezione generica (spec §26, §34).
        """
        url = f"{self._base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds or self._timeout_seconds) as client:
                response = await client.get(url)
        except httpx.TimeoutException as exc:
            raise ComfyTimeout(f"Timeout contattando {url}") from exc
        except httpx.ConnectError as exc:
            raise ComfyUnreachable(f"ComfyUI non raggiungibile su {url}") from exc
        except httpx.HTTPError as exc:
            # Errori di trasporto non altrimenti classificati: trattati come
            # irraggiungibile, mai propagati come eccezione generica al chiamante.
            raise ComfyUnreachable(f"Errore di connessione verso {url}: {exc}") from exc

        if response.status_code >= 400:
            raise ComfyHTTPError(response.status_code, response.text)

        try:
            return response.json()
        except ValueError as exc:
            raise ComfyProtocolError(f"Risposta non JSON da {url}") from exc

    async def get_system_stats(self) -> ComfySystemStats:
        """Chiama GET /system_stats."""
        data = await self._get_json("/system_stats")
        if not isinstance(data, dict):
            raise ComfyProtocolError("Risposta JSON inattesa da /system_stats: non è un oggetto")

        system = data.get("system") if isinstance(data.get("system"), dict) else {}
        return ComfySystemStats(
            version=system.get("comfyui_version"),
            os=system.get("os"),
            python_version=system.get("python_version"),
            pytorch_version=system.get("pytorch_version"),
            raw=data,
        )

    async def get_object_info(self) -> dict[str, dict]:
        """Chiama GET /object_info: schema completo di TUTTI i nodi registrati
        (core + custom node installati), fonte primaria dell'Inventory Engine
        (docs/comfyui-api.md). Ritorna il dict grezzo {class_type: schema} così com'è
        — la normalizzazione (input_summary/output_summary, widget hint) è
        responsabilità di `bridge.inventory` (docs/module-boundaries.md), non del
        client di trasporto.
        """
        data = await self._get_json("/object_info", timeout_seconds=self._object_info_timeout())
        if not isinstance(data, dict):
            raise ComfyProtocolError("Risposta JSON inattesa da /object_info: non è un oggetto")
        return data

    def _object_info_timeout(self) -> float:
        # /object_info può essere pesante con molti custom node installati: un timeout
        # più lungo del default usato per /system_stats (docs/comfyui-api.md).
        return max(self._timeout_seconds, 20.0)
