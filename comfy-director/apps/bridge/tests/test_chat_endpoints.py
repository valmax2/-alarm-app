from __future__ import annotations

import httpx
import respx
from httpx import AsyncClient


async def test_send_without_configured_provider_is_honest_404(client: AsyncClient) -> None:
    response = await client.post("/chat/messages", json={"text": "ciao", "provider_id": "does-not-exist"})
    assert response.status_code == 404


async def test_send_empty_message_is_rejected(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-fake"})
    provider_id = created.json()["id"]
    response = await client.post("/chat/messages", json={"text": "   ", "provider_id": provider_id})
    assert response.status_code == 422


async def test_send_with_local_provider_is_honestly_not_supported(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "local", "label": "VLM locale"})
    provider_id = created.json()["id"]
    response = await client.post("/chat/messages", json={"text": "ciao", "provider_id": provider_id})
    assert response.status_code == 409
    assert "non ancora supportato" in response.json()["detail"]


@respx.mock
async def test_send_message_end_to_end_persists_both_messages(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-ant-fake"})
    provider_id = created.json()["id"]

    route = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "Ciao, come posso aiutarti?"}]})
    )

    response = await client.post("/chat/messages", json={"text": "Ciao!", "provider_id": provider_id})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["role"] == "user" and body[0]["text"] == "Ciao!"
    assert body[1]["role"] == "assistant" and body[1]["text"] == "Ciao, come posso aiutarti?"
    assert body[1]["provider_id"] == provider_id

    # La chiave decifrata deve essere quella davvero salvata.
    assert route.calls[0].request.headers["x-api-key"] == "sk-ant-fake"

    # GET /chat/messages deve mostrare la stessa cronologia, indipendentemente dalla UI.
    listed = await client.get("/chat/messages")
    assert [m["text"] for m in listed.json()] == ["Ciao!", "Ciao, come posso aiutarti?"]


@respx.mock
async def test_send_message_keeps_user_message_when_provider_call_fails(client: AsyncClient) -> None:
    """Se la chiamata al provider fallisce, il messaggio dell'utente resta comunque
    salvato — non deve doverlo riscrivere (vedi routers/chat.py)."""
    created = await client.post("/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-ant-invalid"})
    provider_id = created.json()["id"]

    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(401, json={"error": "invalid key"})
    )

    response = await client.post("/chat/messages", json={"text": "Ciao!", "provider_id": provider_id})
    assert response.status_code == 502

    listed = await client.get("/chat/messages")
    assert len(listed.json()) == 1
    assert listed.json()[0]["role"] == "user"
    assert listed.json()[0]["text"] == "Ciao!"


@respx.mock
async def test_send_message_includes_prior_history(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "anthropic", "label": "Claude", "api_key": "sk-fake"})
    provider_id = created.json()["id"]

    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "risposta 1"}]})
    )
    await client.post("/chat/messages", json={"text": "primo messaggio", "provider_id": provider_id})

    route2 = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "risposta 2"}]})
    )
    await client.post("/chat/messages", json={"text": "secondo messaggio", "provider_id": provider_id})

    import json

    sent = json.loads(route2.calls.last.request.content)
    texts = [m["content"] for m in sent["messages"]]
    assert texts == ["primo messaggio", "risposta 1", "secondo messaggio"]


async def test_clear_messages_empties_history(client: AsyncClient) -> None:
    created = await client.post("/ai-providers", json={"kind": "local", "label": "x"})
    provider_id = created.json()["id"]
    with respx.mock:
        # local rejected before any HTTP call — nessuna mock necessaria
        await client.post("/chat/messages", json={"text": "ciao", "provider_id": provider_id})

    delete_response = await client.delete("/chat/messages")
    assert delete_response.status_code == 204
    listed = await client.get("/chat/messages")
    assert listed.json() == []
