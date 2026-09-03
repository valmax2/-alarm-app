from __future__ import annotations

import httpx
import respx
from httpx import AsyncClient

from bridge.config import Settings

BASE_URL = Settings().default_comfy_base_url
_FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16

OBJECT_INFO = {
    "LoadImage": {
        "input": {"required": {"image": [["existing.png"], {"image_upload": True}]}},
        "output": ["IMAGE", "MASK"], "output_name": ["IMAGE", "MASK"],
        "category": "image", "display_name": "Load Image",
    },
    "KSampler": {
        "input": {"required": {"seed": ["INT", {"default": 0}]}},
        "output": ["LATENT"], "output_name": ["LATENT"], "category": "sampling", "display_name": "KSampler",
    },
}


async def _sync(client: AsyncClient) -> None:
    with respx.mock:
        respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
        respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
        response = await client.post("/comfy/sync")
        assert response.status_code == 200


async def _create_character_with_image(client: AsyncClient) -> tuple[str, str]:
    created = await client.post("/characters", json={"name": "Aria"})
    character_id = created.json()["id"]
    uploaded = await client.post(
        f"/characters/{character_id}/images", files={"file": ("aria.png", _FAKE_PNG, "image/png")}, data={"role": "main"}
    )
    return character_id, uploaded.json()["id"]


async def _create_workflow_with_load_image(client: AsyncClient) -> str:
    created = await client.post("/workflows", json={"name": "Ritratto con riferimento"})
    workflow_id = created.json()["id"]
    graph = {
        "nodes": [{"id": "loader", "class_type": "LoadImage", "position": {"x": 0, "y": 0}, "params": {"image": "old.png"}}],
        "edges": [],
    }
    response = await client.put(f"/workflows/{workflow_id}", json={"graph": graph})
    assert response.status_code == 200
    return workflow_id


async def test_send_character_image_uploads_and_writes_the_real_comfy_filename(client: AsyncClient) -> None:
    await _sync(client)
    character_id, image_id = await _create_character_with_image(client)
    workflow_id = await _create_workflow_with_load_image(client)

    with respx.mock:
        respx.post(f"{BASE_URL}/upload/image").mock(
            return_value=httpx.Response(200, json={"name": "aria (1).png", "subfolder": "", "type": "input"})
        )
        response = await client.post(
            f"/characters/{character_id}/images/{image_id}/send-to-workflow",
            json={"workflow_id": workflow_id, "node_id": "loader"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["class_type"] == "LoadImage"
    assert body["param_name"] == "image"
    assert body["uploaded_filename"] == "aria (1).png"  # nome assegnato da ComfyUI, non quello locale
    assert body["version_number"] == 3  # v1 creazione, v2 save iniziale, v3 invio immagine

    detail = await client.get(f"/workflows/{workflow_id}")
    node = next(n for n in detail.json()["graph"]["nodes"] if n["id"] == "loader")
    assert node["params"]["image"] == "aria (1).png"


async def test_send_character_image_missing_image_is_404(client: AsyncClient) -> None:
    response = await client.post(
        "/characters/does-not-exist/images/does-not-exist/send-to-workflow",
        json={"workflow_id": "x", "node_id": "y"},
    )
    assert response.status_code == 404


async def test_send_character_image_missing_workflow_is_404(client: AsyncClient) -> None:
    character_id, image_id = await _create_character_with_image(client)
    response = await client.post(
        f"/characters/{character_id}/images/{image_id}/send-to-workflow",
        json={"workflow_id": "does-not-exist", "node_id": "loader"},
    )
    assert response.status_code == 404


async def test_send_character_image_missing_node_is_404(client: AsyncClient) -> None:
    await _sync(client)
    character_id, image_id = await _create_character_with_image(client)
    workflow_id = await _create_workflow_with_load_image(client)

    response = await client.post(
        f"/characters/{character_id}/images/{image_id}/send-to-workflow",
        json={"workflow_id": workflow_id, "node_id": "does-not-exist"},
    )
    assert response.status_code == 404


async def test_send_character_image_to_a_node_without_an_image_field_is_422_with_the_real_reason(client: AsyncClient) -> None:
    await _sync(client)
    character_id, image_id = await _create_character_with_image(client)
    created = await client.post("/workflows", json={"name": "Flusso senza LoadImage"})
    workflow_id = created.json()["id"]
    graph = {"nodes": [{"id": "sampler", "class_type": "KSampler", "position": {"x": 0, "y": 0}, "params": {"seed": 1}}], "edges": []}
    await client.put(f"/workflows/{workflow_id}", json={"graph": graph})

    response = await client.post(
        f"/characters/{character_id}/images/{image_id}/send-to-workflow",
        json={"workflow_id": workflow_id, "node_id": "sampler"},
    )
    assert response.status_code == 422
    assert "non ha nessun campo" in response.json()["detail"]


async def test_send_character_image_when_comfy_unreachable_is_a_real_error_not_a_fake_success(client: AsyncClient) -> None:
    await _sync(client)
    character_id, image_id = await _create_character_with_image(client)
    workflow_id = await _create_workflow_with_load_image(client)

    with respx.mock:
        respx.post(f"{BASE_URL}/upload/image").mock(side_effect=httpx.ConnectError("boom"))
        response = await client.post(
            f"/characters/{character_id}/images/{image_id}/send-to-workflow",
            json={"workflow_id": workflow_id, "node_id": "loader"},
        )
    assert response.status_code == 503

    # e il grafo NON deve essere stato modificato da un upload fallito
    detail = await client.get(f"/workflows/{workflow_id}")
    node = next(n for n in detail.json()["graph"]["nodes"] if n["id"] == "loader")
    assert node["params"]["image"] == "old.png"
