"""Test dell'endpoint WebSocket `/generations/{id}/live` (Fase 6 v2).

Chiama la funzione dell'endpoint DIRETTAMENTE (non tramite un client ASGI reale, né
`starlette.testclient.TestClient`): il client HTTP condiviso da tutto il resto della
suite (`httpx.AsyncClient`/`ASGITransport`, vedi conftest.py) non supporta affatto il
protocollo WebSocket (limite noto di httpx), e `TestClient` gestisce l'evento loop
tramite un portal separato che, con un engine SQLAlchemy async + aiosqlite creato in un
loop diverso, può fallire in modo non deterministico ("attached to a different loop") —
un problema di infrastruttura di test, non del codice applicativo. Un oggetto
`WebSocket` fittizio "duck-typed" (stessa interfaccia usata dall'endpoint:
`accept`/`send_json`/`close`/`receive`, più `.app.state`) esercita esattamente la
stessa logica applicativa (traduzione evento→messaggio, persistenza a DB, condizioni di
terminazione), restando nello stesso event loop di pytest-asyncio usato da tutta la
suite. L'handshake WS vero e proprio è infrastruttura di FastAPI/Starlette, non logica
applicativa, e non necessita di un test dedicato qui.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from bridge.comfy_client.ws_events import ComfyWSEvent
from bridge.db import create_all_for_tests, make_session_factory
from bridge.models import ComfyInstanceRecord, GenerationRecord
from bridge.routers.generations import generation_live


class FakeRelay:
    def __init__(self) -> None:
        self.queue: asyncio.Queue[ComfyWSEvent] = asyncio.Queue()
        self.unsubscribed_prompt_id: str | None = None

    def subscribe(self, prompt_id: str) -> asyncio.Queue[ComfyWSEvent]:
        return self.queue

    def unsubscribe(self, prompt_id: str, queue: asyncio.Queue[ComfyWSEvent]) -> None:
        self.unsubscribed_prompt_id = prompt_id


class FakeRelayManager:
    def __init__(self, relay: FakeRelay) -> None:
        self._relay = relay

    def get_relay(self, base_url: str) -> FakeRelay:
        return self._relay


class FakeWebSocket:
    def __init__(self, session_factory, relay_manager) -> None:
        self.app = SimpleNamespace(state=SimpleNamespace(session_factory=session_factory, ws_relay_manager=relay_manager))
        self.sent: list[dict] = []
        self.closed_code: int | None = None
        self._disconnect_event = asyncio.Event()

    async def accept(self) -> None:
        pass

    async def send_json(self, data: dict) -> None:
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        self.closed_code = code

    async def receive(self) -> dict:
        await self._disconnect_event.wait()
        return {"type": "websocket.disconnect"}

    def trigger_client_disconnect(self) -> None:
        self._disconnect_event.set()


async def _wait_until(predicate, timeout: float = 2.0) -> None:
    async def _poll() -> None:
        while not predicate():
            await asyncio.sleep(0.01)

    await asyncio.wait_for(_poll(), timeout=timeout)


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    await create_all_for_tests(engine)
    factory = make_session_factory(engine)
    yield factory
    await engine.dispose()


async def _seed_generation(session_factory, *, status: str = "running", with_prompt: bool = True) -> str:
    async with session_factory() as session:
        instance = ComfyInstanceRecord(id="default", name="default", base_url="http://127.0.0.1:8188")
        session.add(instance)
        generation = GenerationRecord(
            workflow_id=None,
            comfy_instance_id="default",
            comfy_prompt_id="prompt-live-1" if with_prompt else None,
            status=status,
        )
        session.add(generation)
        await session.commit()
        return generation.id


async def test_unknown_generation_sends_error_and_closes(session_factory) -> None:
    relay_manager = FakeRelayManager(FakeRelay())
    ws = FakeWebSocket(session_factory, relay_manager)
    await generation_live(ws, "does-not-exist")
    assert ws.sent == [{"type": "error", "message": "Generazione non trovata"}]
    assert ws.closed_code == 4404


async def test_already_terminal_generation_sends_final_and_closes(session_factory) -> None:
    generation_id = await _seed_generation(session_factory, status="completed")
    relay_manager = FakeRelayManager(FakeRelay())
    ws = FakeWebSocket(session_factory, relay_manager)
    await generation_live(ws, generation_id)
    assert ws.sent == [{"type": "final", "status": "completed"}]
    assert ws.closed_code == 1000


async def test_generation_without_prompt_id_sends_error(session_factory) -> None:
    generation_id = await _seed_generation(session_factory, with_prompt=False)
    relay_manager = FakeRelayManager(FakeRelay())
    ws = FakeWebSocket(session_factory, relay_manager)
    await generation_live(ws, generation_id)
    assert ws.sent[0]["type"] == "error"
    assert ws.closed_code == 4404


async def test_progress_event_is_forwarded_and_persisted(session_factory) -> None:
    generation_id = await _seed_generation(session_factory)
    relay = FakeRelay()
    ws = FakeWebSocket(session_factory, FakeRelayManager(relay))
    task = asyncio.create_task(generation_live(ws, generation_id))
    try:
        relay.queue.put_nowait(
            ComfyWSEvent(
                type="progress", prompt_id="prompt-live-1", node_id="3", progress_value=4, progress_max=20, raw={}
            )
        )
        await _wait_until(lambda: len(ws.sent) >= 1)
        assert ws.sent[0] == {"type": "progress", "node_id": "3", "progress_value": 4, "progress_max": 20}

        async with session_factory() as session:
            generation = await session.get(GenerationRecord, generation_id)
            assert generation.current_node_id == "3"
            assert generation.progress_value == 4
            assert generation.progress_max == 20
    finally:
        ws.trigger_client_disconnect()
        await asyncio.wait_for(task, timeout=2)
    assert relay.unsubscribed_prompt_id == "prompt-live-1"


async def test_executing_with_null_node_sends_final_pending_and_closes_loop(session_factory) -> None:
    generation_id = await _seed_generation(session_factory)
    relay = FakeRelay()
    ws = FakeWebSocket(session_factory, FakeRelayManager(relay))
    task = asyncio.create_task(generation_live(ws, generation_id))
    relay.queue.put_nowait(
        ComfyWSEvent(type="executing", prompt_id="prompt-live-1", node_id=None, progress_value=None, progress_max=None, raw={})
    )
    await asyncio.wait_for(task, timeout=2)  # il loop deve terminare DA SOLO, senza bisogno di un disconnect
    assert ws.sent[-1] == {"type": "final_pending"}
    assert relay.unsubscribed_prompt_id == "prompt-live-1"


async def test_client_disconnect_stops_the_loop_and_unsubscribes(session_factory) -> None:
    generation_id = await _seed_generation(session_factory)
    relay = FakeRelay()
    ws = FakeWebSocket(session_factory, FakeRelayManager(relay))
    task = asyncio.create_task(generation_live(ws, generation_id))
    await asyncio.sleep(0.05)  # lascia partire il loop (in attesa di eventi/disconnessione)
    ws.trigger_client_disconnect()
    await asyncio.wait_for(task, timeout=2)
    assert ws.sent == []  # nessun evento arrivato: nessun messaggio inviato
    assert relay.unsubscribed_prompt_id == "prompt-live-1"
