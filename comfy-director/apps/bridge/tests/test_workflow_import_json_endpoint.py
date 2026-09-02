from __future__ import annotations

import json

import httpx
import respx
from httpx import AsyncClient

from bridge.config import Settings

BASE_URL = Settings().default_comfy_base_url


async def test_import_json_creates_new_workflow_ready_to_open(client: AsyncClient) -> None:
    prompt = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "a.safetensors"}},
    }
    response = await client.post(
        "/workflows/import-json", json={"name": "Importato", "raw_json": json.dumps(prompt)}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "prompt"
    assert body["workflow"]["node_count"] == 1
    assert body["workflow"]["source"] == "imported_json"

    # apribile subito: GET /workflows/{id} deve restituire lo stesso grafo
    detail = await client.get(f"/workflows/{body['workflow']['id']}")
    assert detail.status_code == 200
    graph = detail.json()["graph"]
    assert graph["nodes"][0]["class_type"] == "CheckpointLoaderSimple"
    assert graph["nodes"][0]["params"] == {"ckpt_name": "a.safetensors"}


async def test_import_json_rejects_unrecognized_format(client: AsyncClient) -> None:
    response = await client.post(
        "/workflows/import-json", json={"name": "Non valido", "raw_json": json.dumps({"foo": "bar"})}
    )
    assert response.status_code == 422
    assert "Formato non riconosciuto" in response.json()["detail"]


async def test_import_json_rejects_malformed_json_text(client: AsyncClient) -> None:
    response = await client.post(
        "/workflows/import-json", json={"name": "Non valido", "raw_json": "{ non e json"}
    )
    assert response.status_code == 422
    assert "JSON non valido" in response.json()["detail"]


@respx.mock
async def test_import_json_maps_widgets_using_synced_schema(client: AsyncClient) -> None:
    respx.get(f"{BASE_URL}/system_stats").mock(
        return_value=httpx.Response(200, json={"system": {"comfyui_version": "0.3.12"}})
    )
    respx.get(f"{BASE_URL}/object_info").mock(
        return_value=httpx.Response(
            200,
            json={
                "KSampler": {
                    "input": {"required": {"seed": ["INT", {"default": 0}]}},
                    "output": ["LATENT"], "output_name": ["LATENT"],
                    "category": "sampling", "display_name": "KSampler",
                }
            },
        )
    )
    await client.post("/comfy/sync")

    workflow_json = {
        "nodes": [{"id": 1, "type": "KSampler", "pos": [0, 0], "widgets_values": [999]}],
        "links": [],
    }
    response = await client.post(
        "/workflows/import-json", json={"name": "Con widget", "raw_json": json.dumps(workflow_json)}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["unmapped_widget_node_types"] == []

    detail = await client.get(f"/workflows/{body['workflow']['id']}")
    assert detail.json()["graph"]["nodes"][0]["params"] == {"seed": 999}


async def test_import_json_declares_unmapped_widgets_honestly_without_sync(client: AsyncClient) -> None:
    workflow_json = {
        "nodes": [{"id": 1, "type": "KSampler", "pos": [0, 0], "widgets_values": [999]}],
        "links": [],
    }
    response = await client.post(
        "/workflows/import-json", json={"name": "Senza sync", "raw_json": json.dumps(workflow_json)}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["unmapped_widget_node_types"] == ["KSampler"]

    detail = await client.get(f"/workflows/{body['workflow']['id']}")
    assert detail.json()["graph"]["nodes"][0]["params"] == {}  # mai un valore inventato
