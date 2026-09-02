from __future__ import annotations

import httpx
import respx
from httpx import AsyncClient

from bridge.config import Settings

BASE_URL = Settings().default_comfy_base_url

# Schema /object_info di fixture: due nodi core noti (uno checkpoint, uno LoRA), un
# nodo "custom" (non nell'elenco core), esattamente come li restituirebbe davvero
# ComfyUI (stessa forma: input.required.<param> = [enum_list] oppure [tipo, opts]).
FAKE_OBJECT_INFO = {
    "CheckpointLoaderSimple": {
        "input": {"required": {"ckpt_name": [["sd_xl_base_1.0.safetensors", "flux1-dev.safetensors"]]}},
        "output": ["MODEL", "CLIP", "VAE"],
        "output_name": ["MODEL", "CLIP", "VAE"],
        "category": "loaders",
        "display_name": "Load Checkpoint",
    },
    "LoraLoader": {
        "input": {
            "required": {
                "lora_name": [["style_lora.safetensors"]],
                "strength_model": ["FLOAT", {"default": 1.0, "min": -20.0, "max": 20.0, "step": 0.01}],
            }
        },
        "output": ["MODEL", "CLIP"],
        "output_name": ["MODEL", "CLIP"],
        "category": "loaders",
        "display_name": "Load LoRA",
    },
    "SomeCommunityIPAdapterNode": {
        "input": {"required": {"weight": ["FLOAT", {"default": 0.5}]}},
        "output": ["IMAGE"],
        "output_name": ["IMAGE"],
        "category": "ipadapter",
        "display_name": "Some Community Node",
    },
}


def _mock_comfy(respx_mock) -> None:
    respx_mock.get(f"{BASE_URL}/system_stats").mock(
        return_value=httpx.Response(200, json={"system": {"comfyui_version": "0.3.12"}})
    )
    respx_mock.get(f"{BASE_URL}/object_info").mock(return_value=httpx.Response(200, json=FAKE_OBJECT_INFO))


@respx.mock
async def test_sync_creates_nodes_and_models_from_object_info(client: AsyncClient) -> None:
    _mock_comfy(respx)

    response = await client.post("/comfy/sync")
    assert response.status_code == 200
    body = response.json()

    assert body["comfy_version"] == "0.3.12"
    assert body["node_count"] == 3
    assert body["custom_node_count"] == 1  # solo SomeCommunityIPAdapterNode non è nel registro "core"
    assert body["model_counts_by_type"] == {"checkpoint": 2, "lora": 1}
    assert body["filesystem_scan_used"] is False  # nessun comfy_root_path configurato

    nodes_response = await client.get("/inventory/nodes")
    class_types = {n["class_type"] for n in nodes_response.json()}
    assert class_types == {"CheckpointLoaderSimple", "LoraLoader", "SomeCommunityIPAdapterNode"}
    custom_flags = {n["class_type"]: n["is_custom_node"] for n in nodes_response.json()}
    assert custom_flags["SomeCommunityIPAdapterNode"] is True
    assert custom_flags["CheckpointLoaderSimple"] is False

    models_response = await client.get("/inventory/models")
    models_by_name = {m["name"]: m for m in models_response.json()}
    assert set(models_by_name) == {"sd_xl_base_1.0.safetensors", "flux1-dev.safetensors", "style_lora.safetensors"}
    # nome file soltanto -> family detection debole (internal_rule), mai spacciata per certa
    assert models_by_name["flux1-dev.safetensors"]["family"] == "flux"
    assert models_by_name["flux1-dev.safetensors"]["detection_source"] == "internal_rule"
    assert models_by_name["flux1-dev.safetensors"]["detection_confidence"] < 0.6


@respx.mock
async def test_sync_enriches_with_real_filesystem_scan_when_root_path_configured(
    client: AsyncClient, tmp_path
) -> None:
    _mock_comfy(respx)

    models_dir = tmp_path / "models"
    checkpoints_dir = models_dir / "checkpoints"
    checkpoints_dir.mkdir(parents=True)
    # Stesso file annunciato da ComfyUI via /object_info, ma questa volta con un header
    # .safetensors REALE sul disco che dichiara esplicitamente l'architettura: la
    # detection deve usare questo (fonte 'metadata', alta confidenza), non solo il nome.
    import json
    import struct

    header = {"__metadata__": {"modelspec.architecture": "sdxl-base-1.0"}}
    header_bytes = json.dumps(header).encode()
    with (checkpoints_dir / "sd_xl_base_1.0.safetensors").open("wb") as f:
        f.write(struct.pack("<Q", len(header_bytes)))
        f.write(header_bytes)
        f.write(b"\x00" * 32)

    put_response = await client.put(
        "/settings", json={"comfy_base_url": BASE_URL, "comfy_root_path": str(tmp_path)}
    )
    assert put_response.status_code == 200

    sync_response = await client.post("/comfy/sync")
    assert sync_response.status_code == 200
    assert sync_response.json()["filesystem_scan_used"] is True

    models_response = await client.get("/inventory/models")
    models_by_name = {m["name"]: m for m in models_response.json()}
    enriched = models_by_name["sd_xl_base_1.0.safetensors"]
    assert enriched["family"] == "sdxl"
    assert enriched["detection_source"] == "metadata"
    assert enriched["detection_confidence"] >= 0.9
    assert enriched["size_bytes"] is not None  # arricchito dalla scansione reale


@respx.mock
async def test_sync_fails_when_comfy_offline_and_no_root_path_configured(client: AsyncClient) -> None:
    """Nessuna fonte disponibile (ComfyUI spento, nessun percorso filesystem
    configurato): la sync deve fallire in modo esplicito, mai un report vuoto o
    inventato spacciato per riuscito."""
    respx.get(f"{BASE_URL}/system_stats").mock(side_effect=httpx.ConnectError("refused"))

    response = await client.post("/comfy/sync")
    assert response.status_code == 503


@respx.mock
async def test_sync_succeeds_from_filesystem_alone_when_comfy_is_offline(client: AsyncClient, tmp_path) -> None:
    """Caso d'uso esplicitamente richiesto: l'utente dà solo il percorso della sua
    installazione ComfyUI, che può anche non essere in esecuzione — la sync deve
    comunque produrre un inventario reale dal disco, con `comfy_status` onestamente
    "offline" (mai nascosto) invece di fallire in blocco."""
    respx.get(f"{BASE_URL}/system_stats").mock(side_effect=httpx.ConnectError("refused"))

    models_dir = tmp_path / "models"
    (models_dir / "checkpoints").mkdir(parents=True)
    (models_dir / "checkpoints" / "flux1-dev.safetensors").write_bytes(b"\x00" * 32)

    await client.put("/settings", json={"comfy_base_url": BASE_URL, "comfy_root_path": str(tmp_path)})

    response = await client.post("/comfy/sync")
    assert response.status_code == 200
    body = response.json()
    assert body["comfy_status"] == "offline"
    assert body["comfy_version"] is None
    assert body["filesystem_scan_used"] is True
    assert body["model_counts_by_type"] == {"checkpoint": 1}
    assert body["node_count"] == 0  # nessun /object_info disponibile senza ComfyUI acceso

    models_response = await client.get("/inventory/models")
    names = {m["name"] for m in models_response.json()}
    assert "flux1-dev.safetensors" in names


@respx.mock
async def test_models_family_filter_annotates_by_compatibility(client: AsyncClient) -> None:
    _mock_comfy(respx)
    await client.post("/comfy/sync")

    response = await client.get("/inventory/models", params={"family": "flux"})
    by_name = {m["name"]: m for m in response.json()}

    # flux1-dev.safetensors combacia con la famiglia richiesta ("flux") ma SOLO grazie
    # all'euristica sul nome file (fonte internal_rule, confidenza 0.3): un singolo
    # segnale debole non basta a dichiarare "compatible" (regola non negoziabile §5:
    # mai certezza finta) -> resta "unknown", non nascosto ma nemmeno spacciato per sicuro.
    assert by_name["flux1-dev.safetensors"]["compatibility"] == "unknown"
    # sd_xl_base_1.0.safetensors è rilevato "sdxl" solo dal nome file (bassa
    # confidenza): un mismatch a bassa confidenza produce un warning, MAI
    # un'esclusione silenziosa spacciata per certezza.
    assert by_name["sd_xl_base_1.0.safetensors"]["compatibility"] == "warning"
    assert by_name["sd_xl_base_1.0.safetensors"]["compatibility_reason"]
    # style_lora.safetensors: nessuna famiglia rilevabile dal nome -> unknown, mostrato comunque.
    assert by_name["style_lora.safetensors"]["compatibility"] == "unknown"


@respx.mock
async def test_models_family_filter_hides_high_confidence_incompatible(client: AsyncClient, tmp_path) -> None:
    """Con un header .safetensors reale sul disco (alta confidenza, fonte 'metadata'),
    un mismatch di famiglia DEVE essere nascosto di default — a differenza del caso a
    bassa confidenza (solo nome file) testato sopra."""
    _mock_comfy(respx)

    models_dir = tmp_path / "models"
    checkpoints_dir = models_dir / "checkpoints"
    checkpoints_dir.mkdir(parents=True)
    import json
    import struct

    header = {"__metadata__": {"modelspec.architecture": "sdxl-base-1.0"}}
    header_bytes = json.dumps(header).encode()
    with (checkpoints_dir / "sd_xl_base_1.0.safetensors").open("wb") as f:
        f.write(struct.pack("<Q", len(header_bytes)))
        f.write(header_bytes)
        f.write(b"\x00" * 32)

    await client.put("/settings", json={"comfy_base_url": BASE_URL, "comfy_root_path": str(tmp_path)})
    await client.post("/comfy/sync")

    response = await client.get("/inventory/models", params={"family": "flux"})
    names = {m["name"] for m in response.json()}
    assert "sd_xl_base_1.0.safetensors" not in names

    response_all = await client.get("/inventory/models", params={"family": "flux", "include_incompatible": True})
    entry = next(m for m in response_all.json() if m["name"] == "sd_xl_base_1.0.safetensors")
    assert entry["compatibility"] == "incompatible"
