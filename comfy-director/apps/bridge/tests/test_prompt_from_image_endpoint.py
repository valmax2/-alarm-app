from __future__ import annotations

import json

import httpx
import respx
from httpx import AsyncClient

_FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16  # contenuto non rilevante: mai decodificato come immagine reale qui

STRUCTURED_JSON = {
    "subject": "a cat", "identity": "n/a", "hair": "n/a", "face": "n/a", "body_clothing": "n/a",
    "pose_action": "sitting", "environment": "windowsill", "camera": "close-up", "light": "sunlight",
    "style": "photorealistic", "details": "whiskers visible",
    "final_prompt_en": "photorealistic close-up of a cat sitting on a windowsill in sunlight",
}


async def test_analyze_without_configured_provider_is_honest_404(client: AsyncClient) -> None:
    response = await client.post(
        "/prompt-from-image/analyze",
        files={"file": ("photo.png", _FAKE_PNG, "image/png")},
        data={"provider_id": "does-not-exist"},
    )
    assert response.status_code == 404
    assert "non trovato" in response.json()["detail"]


async def test_analyze_with_local_provider_is_honestly_not_supported(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "local", "label": "VLM locale"})
    provider_id = created.json()["id"]

    response = await client.post(
        "/prompt-from-image/analyze",
        files={"file": ("photo.png", _FAKE_PNG, "image/png")},
        data={"provider_id": provider_id},
    )
    assert response.status_code == 409
    assert "non ancora supportato" in response.json()["detail"]


@respx.mock
async def test_analyze_with_anthropic_provider_end_to_end(client: AsyncClient) -> None:
    created = await client.post(
        "/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-ant-fake-key"}
    )
    provider_id = created.json()["id"]

    route = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": json.dumps(STRUCTURED_JSON)}]})
    )

    response = await client.post(
        "/prompt-from-image/analyze",
        files={"file": ("cat.png", _FAKE_PNG, "image/png")},
        data={"provider_id": provider_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider_kind"] == "anthropic"
    assert body["structured"]["subject"] == "a cat"

    # La chiave decifrata deve essere quella davvero salvata, mai una stringa vuota o placeholder.
    sent_headers = route.calls[0].request.headers
    assert sent_headers["x-api-key"] == "sk-ant-fake-key"


@respx.mock
async def test_analyze_surfaces_real_provider_error(client: AsyncClient) -> None:
    created = await client.post(
        "/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-ant-invalid"}
    )
    provider_id = created.json()["id"]

    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(401, json={"error": {"message": "invalid x-api-key"}})
    )

    response = await client.post(
        "/prompt-from-image/analyze",
        files={"file": ("cat.png", _FAKE_PNG, "image/png")},
        data={"provider_id": provider_id},
    )
    assert response.status_code == 502
    assert "401" in response.json()["detail"]
