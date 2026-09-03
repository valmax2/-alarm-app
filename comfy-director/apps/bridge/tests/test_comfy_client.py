from __future__ import annotations

import httpx
import pytest
import respx

from bridge.comfy_client import (
    ComfyClient,
    ComfyHTTPError,
    ComfyProtocolError,
    ComfyTimeout,
    ComfyUnreachable,
)

BASE_URL = "http://127.0.0.1:8188"


@respx.mock
async def test_get_system_stats_parses_known_fields() -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(
        return_value=httpx.Response(200, json={"system": {"comfyui_version": "0.3.1"}})
    )
    client = ComfyClient(BASE_URL)
    stats = await client.get_system_stats()
    assert stats.version == "0.3.1"
    assert stats.os is None  # campo assente nella fixture: None, mai un default inventato


@respx.mock
async def test_get_system_stats_unreachable() -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(side_effect=httpx.ConnectError("refused"))
    client = ComfyClient(BASE_URL)
    with pytest.raises(ComfyUnreachable):
        await client.get_system_stats()


@respx.mock
async def test_get_system_stats_timeout() -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(side_effect=httpx.TimeoutException("slow"))
    client = ComfyClient(BASE_URL, timeout_seconds=0.01)
    with pytest.raises(ComfyTimeout):
        await client.get_system_stats()


@respx.mock
async def test_get_system_stats_http_error() -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(503, text="unavailable"))
    client = ComfyClient(BASE_URL)
    with pytest.raises(ComfyHTTPError) as exc_info:
        await client.get_system_stats()
    assert exc_info.value.status_code == 503


@respx.mock
async def test_get_system_stats_protocol_error_on_non_json() -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, text="<html>nope</html>"))
    client = ComfyClient(BASE_URL)
    with pytest.raises(ComfyProtocolError):
        await client.get_system_stats()


@respx.mock
async def test_get_system_stats_protocol_error_on_non_object_json() -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json=[1, 2, 3]))
    client = ComfyClient(BASE_URL)
    with pytest.raises(ComfyProtocolError):
        await client.get_system_stats()


@respx.mock
async def test_upload_image_returns_the_name_comfy_assigns() -> None:
    # ComfyUI può rinominare il file per evitare collisioni nella sua cartella
    # input/ — il test verifica che venga usato IL SUO nome, non quello locale.
    respx.post(f"{BASE_URL}/upload/image").mock(
        return_value=httpx.Response(200, json={"name": "aria (1).png", "subfolder": "", "type": "input"})
    )
    client = ComfyClient(BASE_URL)
    result = await client.upload_image("aria.png", b"\x89PNG\r\n\x1a\n", "image/png")
    assert result.name == "aria (1).png"
    assert result.subfolder == ""
    assert result.type == "input"


@respx.mock
async def test_upload_image_unreachable() -> None:
    respx.post(f"{BASE_URL}/upload/image").mock(side_effect=httpx.ConnectError("boom"))
    client = ComfyClient(BASE_URL)
    with pytest.raises(ComfyUnreachable):
        await client.upload_image("aria.png", b"data", "image/png")


@respx.mock
async def test_upload_image_http_error() -> None:
    respx.post(f"{BASE_URL}/upload/image").mock(return_value=httpx.Response(400, text="bad file"))
    client = ComfyClient(BASE_URL)
    with pytest.raises(ComfyHTTPError) as exc_info:
        await client.upload_image("aria.png", b"data", "image/png")
    assert exc_info.value.status_code == 400


@respx.mock
async def test_upload_image_protocol_error_when_name_missing() -> None:
    respx.post(f"{BASE_URL}/upload/image").mock(return_value=httpx.Response(200, json={"subfolder": "", "type": "input"}))
    client = ComfyClient(BASE_URL)
    with pytest.raises(ComfyProtocolError):
        await client.upload_image("aria.png", b"data", "image/png")
