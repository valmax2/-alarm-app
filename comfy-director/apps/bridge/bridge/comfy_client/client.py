"""Client HTTP verso ComfyUI.

Fase 1: implementa solo `get_system_stats`, l'unica chiamata necessaria per il
Bridge-status reale (§3 della spec). Gli altri endpoint documentati in
`docs/comfyui-api.md` (`/object_info`, `/queue`, `/history`, `/prompt`, `/interrupt`,
`/view`, WebSocket) vengono aggiunti nelle fasi che li usano (2 e 6) — aggiungerli ora
senza un chiamante reale e senza test significativi violerebbe la regola "non fingere
funzionalità implementate".

Nessun altro modulo deve aprire connessioni dirette a ComfyUI: questo è l'unico punto di
contatto (vedi docs/module-boundaries.md).
"""

from __future__ import annotations

from dataclasses import dataclass

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

    async def get_system_stats(self) -> ComfySystemStats:
        """Chiama GET /system_stats.

        Solleva `ComfyUnreachable`, `ComfyTimeout`, `ComfyHTTPError` o
        `ComfyProtocolError` — mai un'eccezione generica. Il chiamante (router
        `/comfy/status`) decide come tradurre ciascuna in uno stato UI.
        """
        url = f"{self._base_url}/system_stats"
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
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
            data = response.json()
        except ValueError as exc:
            raise ComfyProtocolError(f"Risposta non JSON da {url}") from exc

        if not isinstance(data, dict):
            raise ComfyProtocolError(f"Risposta JSON inattesa da {url}: non è un oggetto")

        system = data.get("system") if isinstance(data.get("system"), dict) else {}
        return ComfySystemStats(
            version=system.get("comfyui_version"),
            os=system.get("os"),
            python_version=system.get("python_version"),
            pytorch_version=system.get("pytorch_version"),
            raw=data,
        )
