"""Ciclo di vita delle relay WS (`ComfyWSRelay`), Fase 6 v2.

Una `ComfyWSRelay` per base_url di istanza ComfyUI, creata e avviata al primo bisogno
(alla prima generazione che apre `/generations/{id}/live` su quell'istanza) e riusata
dalle generazioni successive sulla stessa istanza — mai una connessione WS per
generazione. Il Bridge supporta più istanze ComfyUI in teoria (`comfy_instances`), per
cui il manager tiene una relay per ciascuna che viene effettivamente usata.
"""

from __future__ import annotations

import uuid

from bridge.comfy_client.ws_relay import ComfyWSRelay


def http_to_ws_url(base_url: str, client_id: str) -> str:
    """Converte l'URL HTTP di un'istanza ComfyUI nell'URL del suo endpoint WS
    persistente (`/ws?clientId=...`, docs/comfyui-api.md)."""
    ws_base = base_url.rstrip("/")
    if ws_base.startswith("https://"):
        ws_base = "wss://" + ws_base[len("https://") :]
    elif ws_base.startswith("http://"):
        ws_base = "ws://" + ws_base[len("http://") :]
    return f"{ws_base}/ws?clientId={client_id}"


class WSRelayManager:
    """Vive su `app.state.ws_relay_manager` (una per processo Bridge)."""

    def __init__(self) -> None:
        self._relays: dict[str, ComfyWSRelay] = {}
        # Client id STABILE per tutta la vita del Bridge, distinto dal client_id
        # effimero generato per ogni singolo POST /prompt (routers/generations.py):
        # la relay è una connessione di ascolto persistente e condivisa, non legata a
        # una singola generazione — riceve gli eventi di TUTTI i prompt in corso
        # sull'istanza (broadcast lato ComfyUI) e li smista per prompt_id.
        self._client_id = uuid.uuid4().hex

    def get_relay(self, base_url: str) -> ComfyWSRelay:
        relay = self._relays.get(base_url)
        if relay is None:
            relay = ComfyWSRelay(http_to_ws_url(base_url, self._client_id))
            relay.start()
            self._relays[base_url] = relay
        return relay

    async def stop_all(self) -> None:
        for relay in self._relays.values():
            await relay.stop()
        self._relays.clear()
