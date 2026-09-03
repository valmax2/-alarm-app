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
    "CLIPTextEncode": {
        "input": {"required": {"text": ["STRING", {"multiline": True}], "clip": ["CLIP", {}]}},
        "output": ["CONDITIONING"], "output_name": ["CONDITIONING"], "category": "conditioning", "display_name": "CLIP Text Encode",
    },
    "KSampler": {
        "input": {
            "required": {
                "model": ["MODEL", {}], "positive": ["CONDITIONING", {}], "negative": ["CONDITIONING", {}],
                "seed": ["INT", {"default": 0}],
            }
        },
        "output": ["LATENT"], "output_name": ["LATENT"], "category": "sampling", "display_name": "KSampler",
    },
}


async def _sync(client: AsyncClient) -> None:
    with respx.mock:
        respx.get(f"{BASE_URL}/system_stats").mock(return_value=httpx.Response(200, json={"system": {}}))
        respx.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=OBJECT_INFO))
        response = await client.post("/comfy/sync")
        assert response.status_code == 200


async def _create_full_workflow(client: AsyncClient, name: str = "Flusso completo", *, with_negative: bool = True) -> str:
    created = await client.post("/workflows", json={"name": name})
    workflow_id = created.json()["id"]

    nodes = [
        {"id": "ckpt", "class_type": "CheckpointLoaderSimple", "position": {"x": 0, "y": 0}, "params": {"ckpt_name": "a.safetensors"}},
        {"id": "pos", "class_type": "CLIPTextEncode", "position": {"x": 200, "y": 0}, "params": {"text": "old positive"}},
        {"id": "sampler", "class_type": "KSampler", "position": {"x": 400, "y": 0}, "params": {"seed": 1}},
    ]
    edges = [
        {"id": "e-model", "source": "ckpt", "source_handle": "MODEL", "target": "sampler", "target_handle": "model"},
        {"id": "e-pos", "source": "pos", "source_handle": "CONDITIONING", "target": "sampler", "target_handle": "positive"},
    ]
    if with_negative:
        nodes.append({"id": "neg", "class_type": "CLIPTextEncode", "position": {"x": 200, "y": 150}, "params": {"text": "old negative"}})
        edges.append({"id": "e-neg", "source": "neg", "source_handle": "CONDITIONING", "target": "sampler", "target_handle": "negative"})

    response = await client.put(f"/workflows/{workflow_id}", json={"graph": {"nodes": nodes, "edges": edges}})
    assert response.status_code == 200
    return workflow_id


async def test_apply_prompt_fills_positive_and_negative_text_nodes(client: AsyncClient) -> None:
    await _sync(client)
    workflow_id = await _create_full_workflow(client)

    response = await client.post(
        f"/workflows/{workflow_id}/apply-prompt",
        json={"text_en": "a woman on a beach", "negative_text_en": "low quality"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["warnings"] == []
    roles = {a["role"]: a for a in body["applied"]}
    assert roles["positive"] == {"role": "positive", "node_id": "pos", "class_type": "CLIPTextEncode", "param_name": "text"}
    assert roles["negative"] == {"role": "negative", "node_id": "neg", "class_type": "CLIPTextEncode", "param_name": "text"}

    # il testo è davvero finito nel grafo persistito, come nuova versione
    assert body["workflow"]["version_number"] == 3  # v1 creazione, v2 save iniziale, v3 apply-prompt
    nodes_by_id = {n["id"]: n for n in body["workflow"]["graph"]["nodes"]}
    assert nodes_by_id["pos"]["params"]["text"] == "a woman on a beach"
    assert nodes_by_id["neg"]["params"]["text"] == "low quality"

    detail = await client.get(f"/workflows/{workflow_id}")
    detail_nodes = {n["id"]: n for n in detail.json()["graph"]["nodes"]}
    assert detail_nodes["pos"]["params"]["text"] == "a woman on a beach"


async def test_apply_prompt_without_negative_text_leaves_negative_node_untouched(client: AsyncClient) -> None:
    await _sync(client)
    workflow_id = await _create_full_workflow(client)

    response = await client.post(f"/workflows/{workflow_id}/apply-prompt", json={"text_en": "only positive"})
    assert response.status_code == 200
    body = response.json()
    assert [a["role"] for a in body["applied"]] == ["positive"]
    nodes_by_id = {n["id"]: n for n in body["workflow"]["graph"]["nodes"]}
    assert nodes_by_id["neg"]["params"]["text"] == "old negative"  # invariato


async def test_apply_prompt_negative_requested_but_no_negative_node_gives_a_warning_not_a_failure(client: AsyncClient) -> None:
    await _sync(client)
    workflow_id = await _create_full_workflow(client, with_negative=False)

    response = await client.post(
        f"/workflows/{workflow_id}/apply-prompt",
        json={"text_en": "only positive", "negative_text_en": "would like this too"},
    )
    assert response.status_code == 200
    body = response.json()
    assert [a["role"] for a in body["applied"]] == ["positive"]
    assert len(body["warnings"]) == 1
    assert "Negative prompt fornito" in body["warnings"][0]


async def test_apply_prompt_with_no_positive_target_fails_with_the_real_reason(client: AsyncClient) -> None:
    await _sync(client)
    created = await client.post("/workflows", json={"name": "Flusso senza sampler"})
    workflow_id = created.json()["id"]
    # grafo vuoto: nessun arco 'positive' da nessuna parte
    response = await client.post(f"/workflows/{workflow_id}/apply-prompt", json={"text_en": "x"})
    assert response.status_code == 422
    assert "Nessun arco" in response.json()["detail"]


async def test_apply_prompt_missing_workflow_is_404(client: AsyncClient) -> None:
    response = await client.post("/workflows/does-not-exist/apply-prompt", json={"text_en": "x"})
    assert response.status_code == 404
