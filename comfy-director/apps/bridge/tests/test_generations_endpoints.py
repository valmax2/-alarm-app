from __future__ import annotations

import httpx
import respx
from httpx import AsyncClient

from bridge.config import Settings

BASE_URL = Settings().default_comfy_base_url

OBJECT_INFO = {
    "CheckpointLoaderSimple": {
        "input": {"required": {"ckpt_name": [["a.safetensors"]]}},
        "output": ["MODEL", "CLIP", "VAE"], "output_name": ["MODEL", "CLIP", "VAE"],
        "category": "loaders", "display_name": "Load Checkpoint",
    },
    "KSampler": {
        "input": {"required": {"model": ["MODEL", {}], "seed": ["INT", {"default": 0}]}},
        "output": ["LATENT"], "output_name": ["LATENT"], "category": "sampling", "display_name": "KSampler",
    },
}

VALID_GRAPH = {
    "nodes": [
        {"id": "1", "class_type": "CheckpointLoaderSimple", "position": {"x": 0, "y": 0}, "params": {"ckpt_name": "a.safetensors"}},
        {"id": "2", "class_type": "KSampler", "position": {"x": 0, "y": 0}, "params": {"seed": 42}},
    ],
    "edges": [{"id": "e1", "source": "1", "source_handle": "MODEL", "target": "2", "target_handle": "model"}],
}

INVALID_GRAPH = {
    "nodes": [{"id": "2", "class_type": "KSampler", "position": {"x": 0, "y": 0}, "params": {}}],
    "edges": [],
}


async def _sync(client: AsyncClient) -> None:
    with respx.mock:
        respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
        respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
        response = await client.post("/comfy/sync")
        assert response.status_code == 200


async def _create_workflow_with_graph(client: AsyncClient, graph: dict) -> str:
    created = await client.post("/workflows", json={"name": "Test"})
    workflow_id = created.json()["id"]
    saved = await client.put(f"/workflows/{workflow_id}", json={"graph": graph})
    assert saved.status_code == 200
    return workflow_id


async def test_generate_blocks_on_validation_errors(client: AsyncClient) -> None:
    await _sync(client)
    workflow_id = await _create_workflow_with_graph(client, INVALID_GRAPH)

    with respx.mock:
        # nessuna rotta /prompt registrata: se il Bridge la chiamasse comunque, respx fa fallire la richiesta
        response = await client.post(f"/workflows/{workflow_id}/generate")

    assert response.status_code == 422
    assert "errori di validazione" in response.json()["detail"]


@respx.mock
async def test_generate_success_creates_queued_generation(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
    respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
    await client.post("/comfy/sync")
    workflow_id = await _create_workflow_with_graph(client, VALID_GRAPH)

    prompt_route = respx.post(f"{BASE_URL}/prompt").mock(
        return_value=httpx.Response(200, json={"prompt_id": "abc123", "number": 1, "node_errors": {}})
    )

    response = await client.post(f"/workflows/{workflow_id}/generate")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "queued"
    assert body["comfy_prompt_id"] == "abc123"
    assert body["workflow_id"] == workflow_id
    assert prompt_route.called

    sent_payload = prompt_route.calls.last.request.content
    import json as _json

    parsed = _json.loads(sent_payload)
    assert parsed["prompt"]["2"]["inputs"]["model"] == ["1", 0]  # arco compilato correttamente


@respx.mock
async def test_generate_with_comfy_node_errors_is_marked_error_immediately(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
    respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
    await client.post("/comfy/sync")
    workflow_id = await _create_workflow_with_graph(client, VALID_GRAPH)

    respx.post(f"{BASE_URL}/prompt").mock(
        return_value=httpx.Response(
            200,
            json={"prompt_id": "bad1", "number": 1, "node_errors": {"2": {"errors": [{"message": "seed out of range"}]}}},
        )
    )

    response = await client.post(f"/workflows/{workflow_id}/generate")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "error"
    assert body["node_errors"]


@respx.mock
async def test_get_generation_polls_history_and_marks_completed(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
    respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
    await client.post("/comfy/sync")
    workflow_id = await _create_workflow_with_graph(client, VALID_GRAPH)

    respx.post(f"{BASE_URL}/prompt").mock(
        return_value=httpx.Response(200, json={"prompt_id": "prompt1", "number": 1, "node_errors": {}})
    )
    generated = await client.post(f"/workflows/{workflow_id}/generate")
    generation_id = generated.json()["id"]

    respx.get(f"{BASE_URL}/history/prompt1").mock(
        return_value=httpx.Response(
            200,
            json={
                "prompt1": {
                    "status": {"status_str": "success", "completed": True},
                    "outputs": {"9": {"images": [{"filename": "ComfyUI_00001.png", "subfolder": "", "type": "output"}]}},
                }
            },
        )
    )

    response = await client.get(f"/generations/{generation_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["outputs"] == [{"filename": "ComfyUI_00001.png", "subfolder": "", "type": "output"}]
    assert body["duration_ms"] is not None


@respx.mock
async def test_get_generation_running_when_in_queue_but_not_history(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
    respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
    await client.post("/comfy/sync")
    workflow_id = await _create_workflow_with_graph(client, VALID_GRAPH)

    respx.post(f"{BASE_URL}/prompt").mock(
        return_value=httpx.Response(200, json={"prompt_id": "prompt2", "number": 1, "node_errors": {}})
    )
    generated = await client.post(f"/workflows/{workflow_id}/generate")
    generation_id = generated.json()["id"]

    respx.get(f"{BASE_URL}/history/prompt2").mock(return_value=httpx.Response(200, json={}))
    respx.get(f"{BASE_URL}/queue").mock(
        return_value=httpx.Response(200, json={"queue_running": [[0, "prompt2", {}, {}, []]], "queue_pending": []})
    )

    response = await client.get(f"/generations/{generation_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


@respx.mock
async def test_get_generation_completes_after_a_prior_poll_set_started_at(client: AsyncClient) -> None:
    """Regressione: il primo poll (stato "running") persiste `started_at` come
    timestamp aware; SQLite lo rilegge "naive" alla richiesta successiva (limite del
    dialetto, non un bug applicativo) — un secondo poll che calcola `duration_ms`
    sottraendo un `datetime.now(UTC)` fresco da quel valore riletto NON deve sollevare
    TypeError ("can't subtract offset-naive and offset-aware datetimes"). Trovato con
    verifica manuale dal vivo (due GET consecutive su una generazione reale), non dai
    test originali — la sessione DB per richiesta nascondeva il problema perché il
    valore restava lo stesso oggetto Python aware in memoria all'interno di una singola
    richiesta."""
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
    respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
    await client.post("/comfy/sync")
    workflow_id = await _create_workflow_with_graph(client, VALID_GRAPH)

    respx.post(f"{BASE_URL}/prompt").mock(
        return_value=httpx.Response(200, json={"prompt_id": "prompt5", "number": 1, "node_errors": {}})
    )
    generated = await client.post(f"/workflows/{workflow_id}/generate")
    generation_id = generated.json()["id"]

    # Primo poll: ancora in coda/esecuzione — persiste started_at.
    respx.get(f"{BASE_URL}/history/prompt5").mock(return_value=httpx.Response(200, json={}))
    respx.get(f"{BASE_URL}/queue").mock(
        return_value=httpx.Response(200, json={"queue_running": [[0, "prompt5", {}, {}, []]], "queue_pending": []})
    )
    first = await client.get(f"/generations/{generation_id}")
    assert first.status_code == 200
    assert first.json()["status"] == "running"
    assert first.json()["started_at"] is not None

    # Secondo poll (nuova request, nuova sessione DB → started_at riletto da SQLite):
    # ora completa, deve calcolare duration_ms senza errori.
    respx.get(f"{BASE_URL}/history/prompt5").mock(
        return_value=httpx.Response(
            200,
            json={"prompt5": {"status": {"status_str": "success", "completed": True}, "outputs": {}}},
        )
    )
    second = await client.get(f"/generations/{generation_id}")
    assert second.status_code == 200
    body = second.json()
    assert body["status"] == "completed"
    assert body["duration_ms"] is not None
    assert body["duration_ms"] >= 0


@respx.mock
async def test_abort_generation_calls_interrupt_and_marks_aborted(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
    respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
    await client.post("/comfy/sync")
    workflow_id = await _create_workflow_with_graph(client, VALID_GRAPH)

    respx.post(f"{BASE_URL}/prompt").mock(
        return_value=httpx.Response(200, json={"prompt_id": "prompt3", "number": 1, "node_errors": {}})
    )
    generated = await client.post(f"/workflows/{workflow_id}/generate")
    generation_id = generated.json()["id"]

    interrupt_route = respx.post(f"{BASE_URL}/interrupt").mock(return_value=httpx.Response(200, json={}))

    response = await client.post(f"/generations/{generation_id}/abort")
    assert response.status_code == 200
    assert response.json()["status"] == "aborted"
    assert interrupt_route.called

    # idempotente: un secondo abort su una generazione già terminata non richiama ComfyUI di nuovo
    second = await client.post(f"/generations/{generation_id}/abort")
    assert second.status_code == 200
    assert second.json()["status"] == "aborted"


@respx.mock
async def test_get_generation_output_file_proxies_bytes(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
    respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
    await client.post("/comfy/sync")
    workflow_id = await _create_workflow_with_graph(client, VALID_GRAPH)

    respx.post(f"{BASE_URL}/prompt").mock(
        return_value=httpx.Response(200, json={"prompt_id": "prompt4", "number": 1, "node_errors": {}})
    )
    generated = await client.post(f"/workflows/{workflow_id}/generate")
    generation_id = generated.json()["id"]

    respx.get(f"{BASE_URL}/history/prompt4").mock(
        return_value=httpx.Response(
            200,
            json={
                "prompt4": {
                    "status": {"status_str": "success", "completed": True},
                    "outputs": {"9": {"images": [{"filename": "out.png", "subfolder": "", "type": "output"}]}},
                }
            },
        )
    )
    await client.get(f"/generations/{generation_id}")  # popola gli output

    respx.get(f"{BASE_URL}/view", params={"filename": "out.png", "subfolder": "", "type": "output"}).mock(
        return_value=httpx.Response(200, content=b"\x89PNG-fake-bytes", headers={"Content-Type": "image/png"})
    )

    response = await client.get(f"/generations/{generation_id}/outputs/0/file")
    assert response.status_code == 200
    assert response.content == b"\x89PNG-fake-bytes"
    assert response.headers["content-type"].startswith("image/png")


async def test_generate_missing_workflow_is_404(client: AsyncClient) -> None:
    response = await client.post("/workflows/does-not-exist/generate")
    assert response.status_code == 404


async def test_get_missing_generation_is_404(client: AsyncClient) -> None:
    response = await client.get("/generations/does-not-exist")
    assert response.status_code == 404
