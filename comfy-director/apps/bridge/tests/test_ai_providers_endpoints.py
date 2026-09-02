from __future__ import annotations

from httpx import AsyncClient


async def test_create_provider_never_returns_api_key(client: AsyncClient) -> None:
    response = await client.post(
        "/ai-providers", json={"kind": "anthropic", "label": "Il mio Claude", "api_key": "sk-ant-super-secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "api_key" not in body
    assert "sk-ant-super-secret" not in response.text
    assert body["has_api_key"] is True
    assert body["kind"] == "anthropic"


async def test_create_provider_requires_api_key_for_cloud_kinds(client: AsyncClient) -> None:
    response = await client.post("/ai-providers", json={"kind": "openai", "label": "Senza chiave"})
    assert response.status_code == 422


async def test_create_local_provider_without_api_key_is_allowed(client: AsyncClient) -> None:
    response = await client.post("/ai-providers", json={"kind": "local", "label": "VLM locale"})
    assert response.status_code == 200
    assert response.json()["has_api_key"] is False


async def test_list_and_delete_provider(client: AsyncClient) -> None:
    created = await client.post(
        "/ai-providers", json={"kind": "anthropic", "label": "Da eliminare", "api_key": "sk-x"}
    )
    provider_id = created.json()["id"]

    listed = await client.get("/ai-providers")
    assert any(p["id"] == provider_id for p in listed.json())

    delete_response = await client.delete(f"/ai-providers/{provider_id}")
    assert delete_response.status_code == 204

    listed_after = await client.get("/ai-providers")
    assert all(p["id"] != provider_id for p in listed_after.json())

    delete_again = await client.delete(f"/ai-providers/{provider_id}")
    assert delete_again.status_code == 404
