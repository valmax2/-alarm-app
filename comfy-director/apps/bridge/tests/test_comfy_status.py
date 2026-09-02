from __future__ import annotations

import httpx
import respx
from httpx import AsyncClient

from bridge.config import Settings

BASE_URL = Settings().default_comfy_base_url  # http://127.0.0.1:8188 di default


@respx.mock
async def test_comfy_status_online(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(
        return_value=httpx.Response(
            200,
            json={
                "system": {
                    "comfyui_version": "0.3.12",
                    "os": "posix",
                    "python_version": "3.11.9",
                    "pytorch_version": "2.4.0",
                }
            },
        )
    )

    response = await client.get("/comfy/status")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "online"
    assert body["version"] == "0.3.12"
    assert body["base_url"] == BASE_URL


@respx.mock
async def test_comfy_status_offline_when_unreachable(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(side_effect=httpx.ConnectError("refused"))

    response = await client.get("/comfy/status")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "offline"
    assert "non raggiungibile" in body["reason"].lower()


@respx.mock
async def test_comfy_status_offline_on_timeout(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(side_effect=httpx.TimeoutException("slow"))

    response = await client.get("/comfy/status")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "offline"
    assert "timeout" in body["reason"].lower()


@respx.mock
async def test_comfy_status_offline_on_http_error(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(500, text="boom"))

    response = await client.get("/comfy/status")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "offline"
    assert "500" in body["reason"]


@respx.mock
async def test_comfy_status_offline_on_malformed_response(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, text="not json"))

    response = await client.get("/comfy/status")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "offline"
