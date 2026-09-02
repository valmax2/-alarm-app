from __future__ import annotations

import zipfile
from io import BytesIO

from httpx import AsyncClient

_FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


async def _create_character_with_image(client: AsyncClient) -> str:
    created = await client.post("/characters", json={"name": "Elena", "tags": ["ritratto"], "description": "una guerriera"})
    character_id = created.json()["id"]
    await client.post(
        f"/characters/{character_id}/images",
        files={"file": ("ritratto.png", _FAKE_PNG, "image/png")},
        data={"role": "main"},
    )
    return character_id


async def test_export_returns_a_valid_zip_with_manifest_and_image(client: AsyncClient) -> None:
    character_id = await _create_character_with_image(client)

    response = await client.get(f"/characters/{character_id}/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "attachment" in response.headers["content-disposition"]

    archive = zipfile.ZipFile(BytesIO(response.content))
    names = archive.namelist()
    assert "character.json" in names
    assert any(n.startswith("images/") for n in names)


async def test_export_missing_character_is_404(client: AsyncClient) -> None:
    response = await client.get("/characters/does-not-exist/export")
    assert response.status_code == 404


async def test_import_creates_a_new_character_with_new_ids(client: AsyncClient) -> None:
    original_id = await _create_character_with_image(client)
    exported = await client.get(f"/characters/{original_id}/export")

    imported = await client.post(
        "/characters/import", files={"file": ("pack.zip", exported.content, "application/zip")}
    )
    assert imported.status_code == 200
    body = imported.json()
    assert body["id"] != original_id
    assert body["name"] == "Elena"
    assert body["description"] == "una guerriera"
    assert body["tags"] == ["ritratto"]
    assert body["image_count"] == 1
    assert body["main_image_id"] is not None

    # indipendente dalla UI: verifichiamo che l'immagine sia leggibile per davvero
    image_id = body["images"][0]["id"]
    image_file = await client.get(f"/characters/{body['id']}/images/{image_id}/file")
    assert image_file.status_code == 200
    assert image_file.content == _FAKE_PNG


async def test_import_does_not_disturb_the_original_character(client: AsyncClient) -> None:
    original_id = await _create_character_with_image(client)
    exported = await client.get(f"/characters/{original_id}/export")
    await client.post("/characters/import", files={"file": ("pack.zip", exported.content, "application/zip")})

    original = await client.get(f"/characters/{original_id}")
    assert original.status_code == 200
    assert original.json()["image_count"] == 1


async def test_import_rejects_invalid_zip(client: AsyncClient) -> None:
    response = await client.post("/characters/import", files={"file": ("pack.zip", b"not a zip", "application/zip")})
    assert response.status_code == 422


async def test_export_then_import_round_trip_preserves_private_flag(client: AsyncClient) -> None:
    created = await client.post("/characters", json={"name": "Segreto", "is_private": True})
    character_id = created.json()["id"]

    exported = await client.get(f"/characters/{character_id}/export")
    imported = await client.post(
        "/characters/import", files={"file": ("pack.zip", exported.content, "application/zip")}
    )
    assert imported.json()["is_private"] is True
