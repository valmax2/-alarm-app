from __future__ import annotations

from httpx import AsyncClient


async def test_create_and_list_preset(client: AsyncClient) -> None:
    created = await client.post(
        "/prompt-presets",
        json={"name": "Ritratto fantasy", "category": "personaggi", "tags": ["fantasy", "ritratto"], "text_en": "a fantasy portrait"},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["name"] == "Ritratto fantasy"
    assert body["category"] == "personaggi"
    assert body["tags"] == ["fantasy", "ritratto"]
    assert body["text_en"] == "a fantasy portrait"

    listed = await client.get("/prompt-presets")
    assert listed.status_code == 200
    assert any(p["id"] == body["id"] for p in listed.json())


async def test_create_rejects_empty_name(client: AsyncClient) -> None:
    response = await client.post("/prompt-presets", json={"name": "  ", "text_en": "x"})
    assert response.status_code == 422


async def test_create_rejects_empty_text_en(client: AsyncClient) -> None:
    response = await client.post("/prompt-presets", json={"name": "X", "text_en": "  "})
    assert response.status_code == 422


async def test_list_filters_by_category(client: AsyncClient) -> None:
    await client.post("/prompt-presets", json={"name": "A", "category": "sfondi", "text_en": "a"})
    await client.post("/prompt-presets", json={"name": "B", "category": "personaggi", "text_en": "b"})

    response = await client.get("/prompt-presets", params={"category": "sfondi"})
    names = [p["name"] for p in response.json()]
    assert names == ["A"]


async def test_list_filters_by_tag(client: AsyncClient) -> None:
    await client.post("/prompt-presets", json={"name": "A", "tags": ["cinematic"], "text_en": "a"})
    await client.post("/prompt-presets", json={"name": "B", "tags": ["anime"], "text_en": "b"})

    response = await client.get("/prompt-presets", params={"tag": "anime"})
    names = [p["name"] for p in response.json()]
    assert names == ["B"]


async def test_list_filters_by_name_search(client: AsyncClient) -> None:
    await client.post("/prompt-presets", json={"name": "Cavaliere oscuro", "text_en": "a"})
    await client.post("/prompt-presets", json={"name": "Foresta incantata", "text_en": "b"})

    response = await client.get("/prompt-presets", params={"q": "cavaliere"})
    names = [p["name"] for p in response.json()]
    assert names == ["Cavaliere oscuro"]


async def test_list_preset_tags_returns_distinct_sorted_tags(client: AsyncClient) -> None:
    await client.post("/prompt-presets", json={"name": "A", "tags": ["cinematic", "dark"], "text_en": "a"})
    await client.post("/prompt-presets", json={"name": "B", "tags": ["cinematic", "anime"], "text_en": "b"})

    response = await client.get("/prompt-presets/tags")
    assert response.status_code == 200
    assert response.json() == ["anime", "cinematic", "dark"]


async def test_update_preset_fields(client: AsyncClient) -> None:
    created = await client.post("/prompt-presets", json={"name": "X", "text_en": "x"})
    preset_id = created.json()["id"]

    updated = await client.put(f"/prompt-presets/{preset_id}", json={"category": "sfondi", "tags": ["moody"]})
    assert updated.status_code == 200
    body = updated.json()
    assert body["category"] == "sfondi"
    assert body["tags"] == ["moody"]
    assert body["name"] == "X"  # invariato


async def test_update_missing_preset_is_404(client: AsyncClient) -> None:
    response = await client.put("/prompt-presets/does-not-exist", json={"name": "Y"})
    assert response.status_code == 404


async def test_update_rejects_blanking_name(client: AsyncClient) -> None:
    created = await client.post("/prompt-presets", json={"name": "X", "text_en": "x"})
    preset_id = created.json()["id"]
    response = await client.put(f"/prompt-presets/{preset_id}", json={"name": "   "})
    assert response.status_code == 422


async def test_delete_preset(client: AsyncClient) -> None:
    created = await client.post("/prompt-presets", json={"name": "X", "text_en": "x"})
    preset_id = created.json()["id"]

    response = await client.delete(f"/prompt-presets/{preset_id}")
    assert response.status_code == 204

    listed = await client.get("/prompt-presets")
    assert all(p["id"] != preset_id for p in listed.json())


async def test_delete_missing_preset_is_404(client: AsyncClient) -> None:
    response = await client.delete("/prompt-presets/does-not-exist")
    assert response.status_code == 404
