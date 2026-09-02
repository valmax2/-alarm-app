from __future__ import annotations

import asyncio

from bridge.comfy_client.ws_events import ComfyWSEvent
from bridge.comfy_client.ws_manager import WSRelayManager, http_to_ws_url
from bridge.comfy_client.ws_relay import ComfyWSRelay

# Questi test esercitano la logica di pub/sub/dispatch di `ComfyWSRelay` direttamente
# (senza aprire una connessione WS reale — `_run`/`websockets.connect` non vengono mai
# chiamati): non c'è un'istanza ComfyUI reale raggiungibile in questo ambiente, stessa
# limitazione già dichiarata per `comfy_client/client.py`. La logica di
# connessione/riconnessione (`_run`) è deliberatamente minimale (delega quasi tutto
# alla libreria `websockets`) e non duplicata qui via mock pesanti.


def _event(prompt_id: str | None, node_id: str | None = None) -> ComfyWSEvent:
    return ComfyWSEvent(
        type="executing", prompt_id=prompt_id, node_id=node_id, progress_value=None, progress_max=None, raw={}
    )


async def test_subscribe_receives_dispatched_event_for_its_prompt_id() -> None:
    relay = ComfyWSRelay("ws://example/ws?clientId=x")
    queue = relay.subscribe("prompt-1")
    relay._dispatch(_event("prompt-1", node_id="3"))
    event = await asyncio.wait_for(queue.get(), timeout=1)
    assert event.node_id == "3"


async def test_dispatch_does_not_leak_to_other_prompt_ids() -> None:
    relay = ComfyWSRelay("ws://example/ws?clientId=x")
    queue_a = relay.subscribe("prompt-a")
    queue_b = relay.subscribe("prompt-b")
    relay._dispatch(_event("prompt-a", node_id="1"))
    event = await asyncio.wait_for(queue_a.get(), timeout=1)
    assert event.node_id == "1"
    assert queue_b.empty()


async def test_dispatch_with_no_subscribers_does_not_raise() -> None:
    relay = ComfyWSRelay("ws://example/ws?clientId=x")
    relay._dispatch(_event("nobody-listening"))  # non deve sollevare


async def test_dispatch_event_without_prompt_id_is_dropped() -> None:
    relay = ComfyWSRelay("ws://example/ws?clientId=x")
    queue = relay.subscribe("prompt-1")
    relay._dispatch(_event(None))
    assert queue.empty()


async def test_unsubscribe_stops_further_dispatch() -> None:
    relay = ComfyWSRelay("ws://example/ws?clientId=x")
    queue = relay.subscribe("prompt-1")
    relay.unsubscribe("prompt-1", queue)
    relay._dispatch(_event("prompt-1", node_id="9"))
    assert queue.empty()


async def test_unsubscribe_unknown_queue_is_a_no_op() -> None:
    relay = ComfyWSRelay("ws://example/ws?clientId=x")
    other_queue: asyncio.Queue = asyncio.Queue()
    relay.unsubscribe("never-subscribed", other_queue)  # non deve sollevare


def test_http_to_ws_url_converts_scheme() -> None:
    assert http_to_ws_url("http://127.0.0.1:8188", "abc") == "ws://127.0.0.1:8188/ws?clientId=abc"


def test_http_to_ws_url_converts_https_scheme() -> None:
    assert http_to_ws_url("https://comfy.example.com", "abc") == "wss://comfy.example.com/ws?clientId=abc"


def test_http_to_ws_url_strips_trailing_slash() -> None:
    assert http_to_ws_url("http://127.0.0.1:8188/", "abc") == "ws://127.0.0.1:8188/ws?clientId=abc"


async def test_manager_reuses_relay_for_same_base_url() -> None:
    manager = WSRelayManager()
    relay_1 = manager.get_relay("http://127.0.0.1:8188")
    relay_2 = manager.get_relay("http://127.0.0.1:8188")
    assert relay_1 is relay_2
    await manager.stop_all()


async def test_manager_creates_distinct_relays_for_distinct_instances() -> None:
    manager = WSRelayManager()
    relay_a = manager.get_relay("http://127.0.0.1:8188")
    relay_b = manager.get_relay("http://127.0.0.1:9000")
    assert relay_a is not relay_b
    await manager.stop_all()


async def test_manager_stop_all_stops_every_relay() -> None:
    manager = WSRelayManager()
    relay = manager.get_relay("http://127.0.0.1:8188")
    relay.start()  # avvia il task di ascolto in background (si connetterà/fallirà da solo)
    await manager.stop_all()
    assert relay._task is None
