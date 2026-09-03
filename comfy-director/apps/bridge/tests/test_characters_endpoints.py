from __future__ import annotations

from httpx import AsyncClient

from bridge.config import Settings

_FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


async def test_create_list_get_character(client: AsyncClient) -> None:
    created = await client.post("/characters", json={"name": "Elena", "tags": ["ritratto", "fantasy"]})
    assert created.status_code == 200
    body = created.json()
    assert body["name"] == "Elena"
    assert body["tags"] == ["ritratto", "fantasy"]
    assert body["image_count"] == 0
    character_id = body["id"]

    listed = await client.get("/characters")
    assert any(c["id"] == character_id for c in listed.json())

    detail = await client.get(f"/characters/{character_id}")
    assert detail.status_code == 200
    assert detail.json()["images"] == []


async def test_get_missing_character_is_404(client: AsyncClient) -> None:
    response = await client.get("/characters/does-not-exist")
    assert response.status_code == 404


async def test_update_character_fields(client: AsyncClient) -> None:
    created = await client.post("/characters", json={"name": "Elena"})
    character_id = created.json()["id"]

    updated = await client.put(f"/characters/{character_id}", json={"is_private": True, "notes": "riferimento interno"})
    assert updated.status_code == 200
    assert updated.json()["is_private"] is True

    detail = await client.get(f"/characters/{character_id}")
    assert detail.json()["notes"] == "riferimento interno"
    assert detail.json()["name"] == "Elena"  # non toccato: solo i campi passati vengono aggiornati


async def test_upload_image_persists_real_bytes_and_sets_main(client: AsyncClient, test_settings: Settings) -> None:
    created = await client.post("/characters", json={"name": "Elena"})
    character_id = created.json()["id"]

    response = await client.post(
        f"/characters/{character_id}/images",
        files={"file": ("ritratto.png", _FAKE_PNG, "image/png")},
        data={"role": "main"},
    )
    assert response.status_code == 200
    image_id = response.json()["id"]
    assert response.json()["role"] == "main"
    assert response.json()["is_hidden"] is False

    detail = await client.get(f"/characters/{character_id}")
    assert detail.json()["main_image_id"] == image_id
    assert detail.json()["image_count"] == 1

    # i byte reali sono davvero su disco, non solo un riferimento nel DB
    stored_files = list((test_settings.storage_dir / "characters" / character_id).iterdir())
    assert len(stored_files) == 1
    assert stored_files[0].read_bytes() == _FAKE_PNG

    # e servibili tramite l'endpoint dedicato
    file_response = await client.get(f"/characters/{character_id}/images/{image_id}/file")
    assert file_response.status_code == 200
    assert file_response.content == _FAKE_PNG
    assert file_response.headers["content-type"] == "image/png"


async def test_update_image_toggles_is_hidden_independently_of_character_privacy(client: AsyncClient) -> None:
    created = await client.post("/characters", json={"name": "Elena"})
    character_id = created.json()["id"]
    uploaded = await client.post(
        f"/characters/{character_id}/images", files={"file": ("x.png", _FAKE_PNG, "image/png")}
    )
    image_id = uploaded.json()["id"]

    response = await client.put(f"/characters/{character_id}/images/{image_id}", json={"is_hidden": True})
    assert response.status_code == 200
    assert response.json()["is_hidden"] is True

    # il personaggio stesso resta pubblico: is_hidden è per-immagine, non collegato a is_private
    detail = await client.get(f"/characters/{character_id}")
    assert detail.json()["is_private"] is False

    # e si può anche togliere di nuovo
    response = await client.put(f"/characters/{character_id}/images/{image_id}", json={"is_hidden": False})
    assert response.json()["is_hidden"] is False


async def test_update_image_missing_is_404(client: AsyncClient) -> None:
    created = await client.post("/characters", json={"name": "Elena"})
    character_id = created.json()["id"]
    response = await client.put(f"/characters/{character_id}/images/does-not-exist", json={"is_hidden": True})
    assert response.status_code == 404


async def test_update_image_belonging_to_another_character_is_404(client: AsyncClient) -> None:
    char_a = (await client.post("/characters", json={"name": "A"})).json()["id"]
    char_b = (await client.post("/characters", json={"name": "B"})).json()["id"]
    uploaded = await client.post(f"/characters/{char_a}/images", files={"file": ("x.png", _FAKE_PNG, "image/png")})
    image_id = uploaded.json()["id"]

    response = await client.put(f"/characters/{char_b}/images/{image_id}", json={"is_hidden": True})
    assert response.status_code == 404


async def test_upload_rejects_empty_file(client: AsyncClient) -> None:
    created = await client.post("/characters", json={"name": "Elena"})
    character_id = created.json()["id"]
    response = await client.post(f"/characters/{character_id}/images", files={"file": ("x.png", b"", "image/png")})
    assert response.status_code == 422


async def test_upload_to_missing_character_is_404(client: AsyncClient) -> None:
    response = await client.post(
        "/characters/does-not-exist/images", files={"file": ("x.png", _FAKE_PNG, "image/png")}
    )
    assert response.status_code == 404


async def test_delete_image_removes_file_and_clears_main(client: AsyncClient, test_settings: Settings) -> None:
    created = await client.post("/characters", json={"name": "Elena"})
    character_id = created.json()["id"]
    uploaded = await client.post(
        f"/characters/{character_id}/images", files={"file": ("x.png", _FAKE_PNG, "image/png")}, data={"role": "main"}
    )
    image_id = uploaded.json()["id"]

    delete_response = await client.delete(f"/characters/{character_id}/images/{image_id}")
    assert delete_response.status_code == 204

    detail = await client.get(f"/characters/{character_id}")
    assert detail.json()["main_image_id"] is None
    assert detail.json()["image_count"] == 0
    assert not (test_settings.storage_dir / "characters" / character_id).exists() or not list(
        (test_settings.storage_dir / "characters" / character_id).iterdir()
    )


async def test_delete_character_removes_directory_from_disk(client: AsyncClient, test_settings: Settings) -> None:
    created = await client.post("/characters", json={"name": "Elena"})
    character_id = created.json()["id"]
    await client.post(f"/characters/{character_id}/images", files={"file": ("x.png", _FAKE_PNG, "image/png")})
    assert (test_settings.storage_dir / "characters" / character_id).exists()

    delete_response = await client.delete(f"/characters/{character_id}")
    assert delete_response.status_code == 204
    assert not (test_settings.storage_dir / "characters" / character_id).exists()

    get_response = await client.get(f"/characters/{character_id}")
    assert get_response.status_code == 404
