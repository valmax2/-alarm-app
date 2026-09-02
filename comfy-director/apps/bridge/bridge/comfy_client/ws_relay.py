"""Relay persistente verso il canale WebSocket di ComfyUI (`/ws?clientId=...`), Fase 6 v2
(spec §18/§26).

Sostituisce il polling di Fase 6 v1 per il SOLO progresso live (nodo in esecuzione,
percentuale di avanzamento) — lo stato finale e gli output restano sempre autorevoli
via `GET /generations/{id}` (storico ComfyUI, `comfy_client/client.py`), mai duplicati
o anticipati qui: se la relay non riesce a connettersi, o si disconnette a metà, il
polling REST resta comunque disponibile come fallback (dichiarato, mai un valore di
progresso inventato in sua assenza).

Una sola connessione WS persistente per istanza ComfyUI (`ComfyWSRelay`), condivisa da
tutte le generazioni in corso su quella istanza (gestita da `ws_manager.WSRelayManager`)
— non una connessione per generazione: coerente con "un solo punto di contatto verso
ComfyUI" per istanza (vedi `comfy_client/client.py`), e con come si comporta la stessa
UI web di ComfyUI (una connessione persistente, eventi filtrati lato client per
`prompt_id`, che ComfyUI include in ogni messaggio `progress`/`executing`).

Non verificabile contro un'istanza ComfyUI reale in questo ambiente (nessuna istanza
raggiungibile, stessa limitazione già dichiarata per `comfy_client/client.py`) —
verificato con un server WebSocket fittizio nei test (`tests/test_ws_relay.py`).
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

import websockets
from websockets.exceptions import WebSocketException

from bridge.comfy_client.ws_events import ComfyWSEvent, parse_comfy_ws_message

logger = logging.getLogger(__name__)

_RECONNECT_DELAY_SECONDS = 2.0


class ComfyWSRelay:
    """Una connessione WS persistente verso una singola istanza ComfyUI, con
    riconnessione automatica. Gli iscritti si registrano per `prompt_id` (una coda
    asyncio a testa) e ricevono solo gli eventi che li riguardano."""

    def __init__(self, ws_url: str) -> None:
        self._ws_url = ws_url
        self._subscribers: dict[str, list[asyncio.Queue[ComfyWSEvent]]] = defaultdict(list)
        self._task: asyncio.Task[None] | None = None
        self._stopped = False

    def start(self) -> None:
        """Avvia il task di ascolto in background, se non già avviato. Idempotente."""
        if self._task is None:
            self._stopped = False
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._stopped = True
        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    def subscribe(self, prompt_id: str) -> asyncio.Queue[ComfyWSEvent]:
        queue: asyncio.Queue[ComfyWSEvent] = asyncio.Queue()
        self._subscribers[prompt_id].append(queue)
        return queue

    def unsubscribe(self, prompt_id: str, queue: asyncio.Queue[ComfyWSEvent]) -> None:
        subs = self._subscribers.get(prompt_id)
        if not subs:
            return
        if queue in subs:
            subs.remove(queue)
        if not subs:
            self._subscribers.pop(prompt_id, None)

    def _dispatch(self, event: ComfyWSEvent) -> None:
        """Esposto separatamente da `_run` così i test possono verificare la
        distribuzione agli iscritti senza aprire una connessione WS reale."""
        if event.prompt_id is None:
            return
        for queue in self._subscribers.get(event.prompt_id, []):
            queue.put_nowait(event)

    async def _run(self) -> None:
        while not self._stopped:
            try:
                async with websockets.connect(self._ws_url, open_timeout=10) as ws:
                    logger.info("Relay WS ComfyUI connessa: %s", self._ws_url)
                    async for raw_message in ws:
                        if not isinstance(raw_message, str):
                            continue  # frame binari (preview immagine): non gestiti in v2, dichiarato
                        event = parse_comfy_ws_message(raw_message)
                        if event is not None:
                            self._dispatch(event)
            except asyncio.CancelledError:
                raise
            except (WebSocketException, OSError) as exc:
                logger.warning(
                    "Relay WS ComfyUI disconnessa (%s): %s — riprovo tra %.0fs",
                    self._ws_url, exc, _RECONNECT_DELAY_SECONDS,
                )
            if not self._stopped:
                await asyncio.sleep(_RECONNECT_DELAY_SECONDS)
