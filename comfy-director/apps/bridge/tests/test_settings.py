from __future__ import annotations

from httpx import AsyncClient


async def test_settings_default(client: AsyncClient) -> None:
    response = await client.get("/settings")
    assert response.status_code == 200
    body = response.json()
    assert body["comfy_base_url"] == "http://127.0.0.1:8188"
    assert body["comfy_root_path"] is None


async def test_settings_update_root_path_persists(client: AsyncClient) -> None:
    put_response = await client.put(
        "/settings", json={"comfy_base_url": "http://127.0.0.1:8188", "comfy_root_path": "/data/ComfyUI"}
    )
    assert put_response.status_code == 200
    assert put_response.json()["comfy_root_path"] == "/data/ComfyUI"

    get_response = await client.get("/settings")
    assert get_response.json()["comfy_root_path"] == "/data/ComfyUI"


async def test_settings_update_persists(client: AsyncClient) -> None:
    put_response = await client.put("/settings", json={"comfy_base_url": "http://192.168.1.50:8188"})
    assert put_response.status_code == 200
    assert put_response.json()["comfy_base_url"] == "http://192.168.1.50:8188"

    get_response = await client.get("/settings")
    assert get_response.status_code == 200
    assert get_response.json()["comfy_base_url"] == "http://192.168.1.50:8188"
