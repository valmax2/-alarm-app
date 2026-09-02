from __future__ import annotations

import json

import pytest

from bridge.workflow import NodeSchemaInfo
from bridge.workflow_import import WorkflowJsonImportError, import_workflow_json

CHECKPOINT_SCHEMA = NodeSchemaInfo(
    input_summary=[{"name": "ckpt_name", "kind": "required", "enum_values": ["a.safetensors"], "type": None}],
    output_summary=[{"name": "MODEL", "type": "MODEL"}, {"name": "CLIP", "type": "CLIP"}, {"name": "VAE", "type": "VAE"}],
)
KSAMPLER_SCHEMA = NodeSchemaInfo(
    input_summary=[
        {"name": "model", "kind": "required", "enum_values": None, "type": "MODEL"},
        {"name": "seed", "kind": "required", "enum_values": None, "type": "INT", "default": 0},
        {"name": "steps", "kind": "required", "enum_values": None, "type": "INT", "default": 20},
    ],
    output_summary=[{"name": "LATENT", "type": "LATENT"}],
)
KNOWN_SCHEMAS = {"CheckpointLoaderSimple": CHECKPOINT_SCHEMA, "KSampler": KSAMPLER_SCHEMA}


def test_prompt_format_splits_params_and_edges_using_known_schema():
    prompt = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "a.safetensors"}},
        "2": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": 42, "steps": 20}},
    }
    result = import_workflow_json(prompt, KNOWN_SCHEMAS)

    assert result.source == "prompt"
    assert result.node_count == 2
    assert result.edge_count == 1
    assert result.unmapped_widget_node_types == []

    node2 = next(n for n in result.graph.nodes if n.id == "2")
    assert node2.params == {"seed": 42, "steps": 20}
    edge = result.graph.edges[0]
    assert edge.source == "1" and edge.source_handle == "MODEL"
    assert edge.target == "2" and edge.target_handle == "model"


def test_prompt_format_falls_back_to_slot_index_when_source_schema_unknown():
    prompt = {
        "1": {"class_type": "SomeUnknownLoader", "inputs": {}},
        "2": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": 1, "steps": 1}},
    }
    result = import_workflow_json(prompt, KNOWN_SCHEMAS)

    assert result.unmapped_widget_node_types == ["SomeUnknownLoader"]
    edge = result.graph.edges[0]
    assert edge.source_handle == "0"  # ripiego onesto sull'indice, mai un nome inventato


def test_ui_workflow_format_maps_widgets_positionally_via_known_schema():
    workflow = {
        "nodes": [
            {
                "id": 1, "type": "CheckpointLoaderSimple", "pos": [10, 20], "widgets_values": ["a.safetensors"],
                "outputs": [{"name": "MODEL", "type": "MODEL"}, {"name": "CLIP", "type": "CLIP"}, {"name": "VAE", "type": "VAE"}],
            },
            {
                "id": 2, "type": "KSampler", "pos": [300, 20],
                "inputs": [{"name": "model", "type": "MODEL", "link": 1}],
                "widgets_values": [777, 30],
            },
        ],
        "links": [[1, 1, 0, 2, 0, "MODEL"]],
    }
    result = import_workflow_json(workflow, KNOWN_SCHEMAS)

    assert result.source == "workflow"
    assert result.node_count == 2
    assert result.unmapped_widget_node_types == []

    node1 = next(n for n in result.graph.nodes if n.id == "1")
    assert node1.position == {"x": 10.0, "y": 20.0}
    assert node1.params == {"ckpt_name": "a.safetensors"}

    node2 = next(n for n in result.graph.nodes if n.id == "2")
    assert node2.params == {"seed": 777, "steps": 30}

    edge = result.graph.edges[0]
    assert edge.source == "1" and edge.source_handle == "MODEL"
    assert edge.target == "2" and edge.target_handle == "model"


def test_ui_workflow_format_leaves_params_empty_when_node_type_unknown():
    workflow = {
        "nodes": [{"id": 1, "type": "SomeCustomNode", "pos": [0, 0], "widgets_values": ["x", 1]}],
        "links": [],
    }
    result = import_workflow_json(workflow, KNOWN_SCHEMAS)

    assert result.unmapped_widget_node_types == ["SomeCustomNode"]
    assert result.graph.nodes[0].params == {}  # mai un valore inventato senza schema


def test_ui_workflow_format_without_position_uses_grid_fallback():
    workflow = {"nodes": [{"id": 1, "type": "CheckpointLoaderSimple"}], "links": []}
    result = import_workflow_json(workflow, KNOWN_SCHEMAS)
    assert result.graph.nodes[0].position == {"x": 120.0, "y": 120.0}


def test_invalid_json_string_raises_honest_error():
    with pytest.raises(WorkflowJsonImportError, match="JSON non valido"):
        import_workflow_json("{not valid json", KNOWN_SCHEMAS)


def test_unrecognized_format_raises_honest_error():
    with pytest.raises(WorkflowJsonImportError, match="Formato non riconosciuto"):
        import_workflow_json({"foo": "bar"}, KNOWN_SCHEMAS)


def test_empty_graph_raises_honest_error():
    with pytest.raises(WorkflowJsonImportError, match="Nessun nodo"):
        import_workflow_json({"nodes": [], "links": []}, KNOWN_SCHEMAS)


def test_accepts_raw_json_text_not_just_dict():
    prompt_text = json.dumps({"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "a.safetensors"}}})
    result = import_workflow_json(prompt_text, KNOWN_SCHEMAS)
    assert result.node_count == 1
