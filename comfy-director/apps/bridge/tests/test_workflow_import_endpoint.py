from __future__ import annotations

import json
import struct
import zlib

import httpx
import respx
from httpx import AsyncClient

from bridge.config import Settings

BASE_URL = Settings().default_comfy_base_url
_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(chunk_type: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", zlib.crc32(chunk_type + data))


def _png_with_workflow(graph: dict) -> bytes:
    text_chunk = _chunk(b"tEXt", b"workflow\x00" + json.dumps(graph).encode("latin-1"))
    return _SIGNATURE + text_chunk + _chunk(b"IEND", b"")


UI_WORKFLOW = {
    "nodes": [
        {"id": 1, "type": "CheckpointLoaderSimple", "title": "Load Checkpoint"},
        {"id": 2, "type": "SomeUninstalledCustomNode", "title": "?"},
    ],
    "links": [],
}


async def test_workflow_from_image_without_prior_sync_is_not_verified(client: AsyncClient) -> None:
    image = _png_with_workflow(UI_WORKFLOW)
    response = await client.post(
        "/workflow-import/from-image", files={"file": ("test.png", image, "image/png")}
    )
    assert response.status_code == 200
    body = response.json()

    assert body["found"] is True
    assert body["inventory_checked"] is False
    assert all(n["present_in_inventory"] is None for n in body["nodes"])
    assert body["missing_node_types"] == []  # non possiamo affermarlo senza una sync


async def test_workflow_from_image_without_metadata_is_honest(client: AsyncClient) -> None:
    plain_png = _SIGNATURE + _chunk(b"IEND", b"")
    response = await client.post(
        "/workflow-import/from-image", files={"file": ("test.png", plain_png, "image/png")}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["found"] is False
    assert "non trovato nei metadata" in body["message"]


@respx.mock
async def test_workflow_from_image_flags_missing_nodes_after_sync(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(
        return_value=httpx.Response(200, json={"system": {"comfyui_version": "0.3.12"}})
    )
    respx.get(f"{BASE_URL}/object_info").mock(
        return_value=httpx.Response(
            200,
            json={
                "CheckpointLoaderSimple": {
                    "input": {"required": {}}, "output": ["MODEL"], "output_name": ["MODEL"],
                    "category": "loaders", "display_name": "Load Checkpoint",
                }
            },
        )
    )
    await client.post("/comfy/sync")

    image = _png_with_workflow(UI_WORKFLOW)
    response = await client.post(
        "/workflow-import/from-image", files={"file": ("test.png", image, "image/png")}
    )
    body = response.json()

    assert body["inventory_checked"] is True
    assert body["missing_node_types"] == ["SomeUninstalledCustomNode"]
    by_type = {n["class_type"]: n["present_in_inventory"] for n in body["nodes"]}
    assert by_type["CheckpointLoaderSimple"] is True
    assert by_type["SomeUninstalledCustomNode"] is False


async def test_workflow_from_image_creates_a_real_workflow_openable_in_canvas(client: AsyncClient) -> None:
    """Bug reale trovato durante l'audit di robustezza: prima di questa correzione
    l'endpoint si fermava a un riassunto di sola lettura, senza mai creare un
    workflow apribile — esattamente il vuoto segnalato dall'utente ("carico
    un'immagine e poi non vedo nulla sulla canvas")."""
    image = _png_with_workflow(UI_WORKFLOW)
    response = await client.post(
        "/workflow-import/from-image", files={"file": ("mio-flusso.png", image, "image/png")}
    )
    assert response.status_code == 200
    body = response.json()

    assert body["workflow"] is not None
    assert body["workflow"]["name"] == "mio-flusso"
    assert body["workflow"]["node_count"] == 2
    workflow_id = body["workflow"]["id"]

    # e soprattutto: è DAVVERO apribile in canvas, non solo un id restituito a vuoto.
    detail = await client.get(f"/workflows/{workflow_id}")
    assert detail.status_code == 200
    assert len(detail.json()["graph"]["nodes"]) == 2


async def test_workflow_from_image_without_a_workflow_found_has_no_workflow_field(client: AsyncClient) -> None:
    plain_png = _SIGNATURE + _chunk(b"IEND", b"")
    response = await client.post(
        "/workflow-import/from-image", files={"file": ("test.png", plain_png, "image/png")}
    )
    assert response.status_code == 200
    assert response.json()["workflow"] is None
