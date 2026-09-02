from __future__ import annotations

import httpx
import respx
from httpx import AsyncClient


async def test_translate_without_configured_provider_is_honest_404(client: AsyncClient) -> None:
    response = await client.post("/prompts/translate", json={"text_it": "ciao", "provider_id": "does-not-exist"})
    assert response.status_code == 404


async def test_translate_empty_text_is_rejected(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-fake"})
    provider_id = created.json()["id"]
    response = await client.post("/prompts/translate", json={"text_it": "   ", "provider_id": provider_id})
    assert response.status_code == 422


async def test_translate_with_local_provider_is_honestly_not_supported(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "local", "label": "VLM locale"})
    provider_id = created.json()["id"]
    response = await client.post("/prompts/translate", json={"text_it": "ciao", "provider_id": provider_id})
    assert response.status_code == 409


@respx.mock
async def test_translate_end_to_end_with_real_key_reaches_provider(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-ant-fake"})
    provider_id = created.json()["id"]

    route = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "a red cat"}]})
    )

    response = await client.post("/prompts/translate", json={"text_it": "un gatto rosso", "provider_id": provider_id})
    assert response.status_code == 200
    assert response.json()["text_en"] == "a red cat"
    assert route.calls[0].request.headers["x-api-key"] == "sk-ant-fake"


async def test_create_list_update_delete_prompt(client: AsyncClient) -> None:
    created = await client.post("/prompts", json={"text_it": "un gatto rosso", "text_en": "a red cat"})
    assert created.status_code == 200
    body = created.json()
    assert body["text_en"] == "a red cat"
    assert body["generation_id"] is None  # nessun collegamento a una generazione in questa fase
    prompt_id = body["id"]

    listed = await client.get("/prompts")
    assert any(p["id"] == prompt_id for p in listed.json())

    updated = await client.put(f"/prompts/{prompt_id}", json={"text_en": "a big red cat", "translation_locked": True})
    assert updated.status_code == 200
    assert updated.json()["text_en"] == "a big red cat"
    assert updated.json()["translation_locked"] is True
    assert updated.json()["text_it"] == "un gatto rosso"  # non toccato

    deleted = await client.delete(f"/prompts/{prompt_id}")
    assert deleted.status_code == 204
    listed_after = await client.get("/prompts")
    assert not any(p["id"] == prompt_id for p in listed_after.json())


async def test_create_prompt_rejects_empty_text_en(client: AsyncClient) -> None:
    response = await client.post("/prompts", json={"text_en": "   "})
    assert response.status_code == 422


async def test_update_missing_prompt_is_404(client: AsyncClient) -> None:
    response = await client.put("/prompts/does-not-exist", json={"text_en": "x"})
    assert response.status_code == 404
