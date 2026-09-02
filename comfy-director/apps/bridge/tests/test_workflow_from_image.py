from __future__ import annotations

import json
import struct
import zlib

from bridge.workflow_import import extract_workflow_from_image

_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(chunk_type: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", zlib.crc32(chunk_type + data))


def _png_with_text(**keyword_to_text: str) -> bytes:
    chunks = b"".join(
        _chunk(b"tEXt", k.encode("latin-1") + b"\x00" + v.encode("latin-1")) for k, v in keyword_to_text.items()
    )
    return _SIGNATURE + chunks + _chunk(b"IEND", b"")


UI_WORKFLOW = {
    "nodes": [
        {"id": 1, "type": "CheckpointLoaderSimple", "title": "Load Checkpoint"},
        {"id": 2, "type": "IPAdapterModelLoader", "title": "IPAdapter"},
    ],
    "links": [[1, 1, 0, 2, 0, "MODEL"]],
}

API_PROMPT = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
    "2": {"class_type": "KSampler", "inputs": {"seed": 42}},
}


def test_extracts_ui_workflow_when_present() -> None:
    image = _png_with_text(workflow=json.dumps(UI_WORKFLOW))
    result = extract_workflow_from_image(image)

    assert result.found is True
    assert result.source == "workflow"
    assert result.node_count == 2
    assert result.link_count == 1
    assert {n.class_type for n in result.nodes} == {"CheckpointLoaderSimple", "IPAdapterModelLoader"}


def test_prefers_workflow_over_prompt_when_both_present() -> None:
    image = _png_with_text(workflow=json.dumps(UI_WORKFLOW), prompt=json.dumps(API_PROMPT))
    result = extract_workflow_from_image(image)
    assert result.source == "workflow"


def test_falls_back_to_api_prompt_when_only_that_is_present() -> None:
    image = _png_with_text(prompt=json.dumps(API_PROMPT))
    result = extract_workflow_from_image(image)

    assert result.found is True
    assert result.source == "prompt"
    assert result.node_count == 2
    assert result.link_count == 0  # il formato API non elenca link separatamente


def test_no_metadata_returns_honest_not_found() -> None:
    image = _png_with_text(Software="GIMP 2.10")
    result = extract_workflow_from_image(image)

    assert result.found is False
    assert result.source is None
    assert "non trovato nei metadata" in result.message
    assert result.raw_graph is None


def test_marks_missing_node_types_when_inventory_known() -> None:
    image = _png_with_text(workflow=json.dumps(UI_WORKFLOW))
    known = {"CheckpointLoaderSimple"}  # IPAdapterModelLoader non è "installato" in questo scenario

    result = extract_workflow_from_image(image, known_class_types=known)

    assert result.inventory_checked is True
    assert result.missing_node_types == ["IPAdapterModelLoader"]
    by_type = {n.class_type: n.present_in_inventory for n in result.nodes}
    assert by_type["CheckpointLoaderSimple"] is True
    assert by_type["IPAdapterModelLoader"] is False


def test_present_in_inventory_is_none_when_no_sync_done() -> None:
    image = _png_with_text(workflow=json.dumps(UI_WORKFLOW))
    result = extract_workflow_from_image(image, known_class_types=None)

    assert result.inventory_checked is False
    assert all(n.present_in_inventory is None for n in result.nodes)
    assert result.missing_node_types == []  # non possiamo affermare cosa manca senza dati


def test_invalid_image_bytes_returns_honest_message_not_a_crash() -> None:
    result = extract_workflow_from_image(b"definitely not a png")
    assert result.found is False
    assert "non leggibile" in result.message
