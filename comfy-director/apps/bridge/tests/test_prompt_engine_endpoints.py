from __future__ import annotations

from httpx import AsyncClient


async def test_catalog_returns_all_sections(client: AsyncClient) -> None:
    response = await client.get("/prompt-engine/catalog")
    assert response.status_code == 200
    body = response.json()
    assert "female" in body["body"]
    assert "male" in body["body"]
    assert len(body["face"]) > 0
    assert "Corti" in body["hair_categories"]
    assert len(body["hair_colors"]) > 0
    assert len(body["clothing_states"]) > 0
    assert "Reggiseni" in body["underwear_categories"]
    assert len(body["actions"]) > 0
    assert len(body["poses"]) > 0
    assert len(body["environments"]) > 0
    assert {g["key"] for g in body["camera"]} == {"framing", "angle", "lens"}
    assert len(body["lights"]) > 0
    assert body["negative_default"]


async def test_catalog_body_groups_have_the_expected_shape(client: AsyncClient) -> None:
    response = await client.get("/prompt-engine/catalog")
    female_build = next(g for g in response.json()["body"]["female"] if g["key"] == "build")
    assert female_build["label_it"] == "Corporatura"
    assert {o["label_it"]: o["value_en"] for o in female_build["options"]}["Snella"] == "slim body"


async def test_compose_minimal_request(client: AsyncClient) -> None:
    response = await client.post("/prompt-engine/compose", json={"gender": "female"})
    assert response.status_code == 200
    assert "adult woman" in response.json()["text_en"]


async def test_compose_with_body_and_camera_selections(client: AsyncClient) -> None:
    response = await client.post(
        "/prompt-engine/compose",
        json={
            "gender": "male", "age": 30, "body": {"build": "athletic body"},
            "camera_framing": "close-up shot", "light": "cinematic lighting",
        },
    )
    assert response.status_code == 200
    text = response.json()["text_en"]
    assert "adult man" in text
    assert "30 years old" in text
    assert "athletic body" in text
    assert "FRAMING — STRONG: close-up shot" in text
    assert "cinematic lighting" in text


async def test_compose_with_coherent_character_uses_real_character_data(client: AsyncClient) -> None:
    created = await client.post(
        "/characters", json={"name": "Aria", "description": "una guerriera", "tags": ["fantasy", "protagonista"]}
    )
    character_id = created.json()["id"]

    response = await client.post(
        "/prompt-engine/compose",
        json={"gender": "female", "coherent_character_id": character_id, "face_mode": "create", "face": {"eyes": "large eyes"}},
    )
    assert response.status_code == 200
    text = response.json()["text_en"]
    assert "CHARACTER CONSISTENCY" in text
    assert "Character name: Aria." in text
    assert "una guerriera" in text
    assert "large eyes" not in text  # sostituito, mai sommato


async def test_compose_with_missing_coherent_character_is_404(client: AsyncClient) -> None:
    response = await client.post(
        "/prompt-engine/compose", json={"gender": "female", "coherent_character_id": "does-not-exist"}
    )
    assert response.status_code == 404


async def test_compose_does_not_persist_anything(client: AsyncClient) -> None:
    """Utility pura come /prompts/translate: non deve creare righe in prompts."""
    await client.post("/prompt-engine/compose", json={"gender": "female", "action": "standing"})
    prompts = await client.get("/prompts")
    assert prompts.json() == []
