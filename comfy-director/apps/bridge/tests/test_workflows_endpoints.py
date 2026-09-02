from __future__ import annotations

import httpx
import respx
from httpx import AsyncClient

from bridge.config import Settings

BASE_URL = Settings().default_comfy_base_url

OBJECT_INFO = {
    "CheckpointLoaderSimple": {
        "input": {"required": {"ckpt_name": [["a.safetensors"]]}},
        "output": ["MODEL", "CLIP", "VAE"], "output_name": ["MODEL", "CLIP", "VAE"],
        "category": "loaders", "display_name": "Load Checkpoint",
    },
    "KSampler": {
        "input": {"required": {"model": ["MODEL", {}], "seed": ["INT", {"default": 0}]}},
        "output": ["LATENT"], "output_name": ["LATENT"], "category": "sampling", "display_name": "KSampler",
    },
}


async def _sync(client: AsyncClient) -> None:
    with respx.mock:
        respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
        respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
        response = await client.post("/comfy/sync")
        assert response.status_code == 200


async def test_create_list_and_get_empty_workflow(client: AsyncClient) -> None:
    created = await client.post("/workflows", json={"name": "Il mio primo flusso"})
    assert created.status_code == 200
    body = created.json()
    assert body["name"] == "Il mio primo flusso"
    assert body["node_count"] == 0
    workflow_id = body["id"]

    listed = await client.get("/workflows")
    assert any(w["id"] == workflow_id for w in listed.json())

    detail = await client.get(f"/workflows/{workflow_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["version_number"] == 1
    assert detail_body["graph"] == {"nodes": [], "edges": []}
    assert detail_body["validation_issues"] == []


async def test_get_missing_workflow_is_404(client: AsyncClient) -> None:
    response = await client.get("/workflows/does-not-exist")
    assert response.status_code == 404


async def test_save_graph_creates_new_version_and_reports_validation_issues(client: AsyncClient) -> None:
    await _sync(client)
    created = await client.post("/workflows", json={"name": "Flusso di test"})
    workflow_id = created.json()["id"]

    # KSampler senza 'model' collegato né valorizzato, e senza 'seed' -> errori attesi
    graph = {
        "nodes": [{"id": "n1", "class_type": "KSampler", "position": {"x": 0, "y": 0}, "params": {}}],
        "edges": [],
    }
    response = await client.put(f"/workflows/{workflow_id}", json={"graph": graph})
    assert response.status_code == 200
    body = response.json()
    assert body["version_number"] == 2
    assert len(body["validation_issues"]) == 2
    assert all(i["severity"] == "error" for i in body["validation_issues"])

    # rileggendolo, la versione corrente è ora quella appena salvata
    detail = await client.get(f"/workflows/{workflow_id}")
    assert detail.json()["version_number"] == 2
    assert detail.json()["graph"]["nodes"][0]["class_type"] == "KSampler"


async def test_save_valid_graph_has_no_issues(client: AsyncClient) -> None:
    await _sync(client)
    created = await client.post("/workflows", json={"name": "Flusso valido"})
    workflow_id = created.json()["id"]

    graph = {
        "nodes": [
            {"id": "n1", "class_type": "CheckpointLoaderSimple", "position": {"x": 0, "y": 0}, "params": {"ckpt_name": "a.safetensors"}},
            {"id": "n2", "class_type": "KSampler", "position": {"x": 200, "y": 0}, "params": {"seed": 1}},
        ],
        "edges": [{"id": "e1", "source": "n1", "source_handle": "MODEL", "target": "n2", "target_handle": "model"}],
    }
    response = await client.put(f"/workflows/{workflow_id}", json={"graph": graph})
    assert response.status_code == 200
    assert response.json()["validation_issues"] == []


async def test_delete_workflow(client: AsyncClient) -> None:
    created = await client.post("/workflows", json={"name": "Da eliminare"})
    workflow_id = created.json()["id"]

    delete_response = await client.delete(f"/workflows/{workflow_id}")
    assert delete_response.status_code == 204

    get_response = await client.get(f"/workflows/{workflow_id}")
    assert get_response.status_code == 404

    delete_again = await client.delete(f"/workflows/{workflow_id}")
    assert delete_again.status_code == 404


async def test_node_schema_endpoint(client: AsyncClient) -> None:
    await _sync(client)
    response = await client.get("/inventory/nodes/KSampler/schema")
    assert response.status_code == 200
    body = response.json()
    assert body["class_type"] == "KSampler"
    names = {i["name"] for i in body["input_summary"]}
    assert {"model", "seed"} <= names


async def test_node_schema_endpoint_unknown_class_is_404(client: AsyncClient) -> None:
    response = await client.get("/inventory/nodes/DoesNotExist/schema")
    assert response.status_code == 404


async def test_known_families_endpoint_returns_non_empty_list(client: AsyncClient) -> None:
    response = await client.get("/workflows/known-families")
    assert response.status_code == 200
    families = response.json()
    assert "sdxl" in families and "flux" in families


async def test_create_workflow_with_family_persists_and_lists_it(client: AsyncClient) -> None:
    created = await client.post("/workflows", json={"name": "Flusso WAN", "family": "wan"})
    assert created.status_code == 200
    assert created.json()["family"] == "wan"

    listed = await client.get("/workflows")
    matching = next(w for w in listed.json() if w["id"] == created.json()["id"])
    assert matching["family"] == "wan"


async def test_create_workflow_with_blank_family_is_treated_as_unset(client: AsyncClient) -> None:
    created = await client.post("/workflows", json={"name": "Senza famiglia", "family": "   "})
    assert created.status_code == 200
    assert created.json()["family"] is None
