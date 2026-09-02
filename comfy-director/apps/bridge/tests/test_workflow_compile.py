from __future__ import annotations

import pytest

from bridge.workflow import (
    CompileError,
    GraphEdge,
    GraphNode,
    NodeSchemaInfo,
    WorkflowGraph,
    compile_to_comfy_payload,
)

CHECKPOINT_SCHEMA = NodeSchemaInfo(
    input_summary=[{"name": "ckpt_name", "kind": "required", "enum_values": ["a.safetensors"], "type": None}],
    output_summary=[{"name": "MODEL", "type": "MODEL"}, {"name": "CLIP", "type": "CLIP"}, {"name": "VAE", "type": "VAE"}],
)
KSAMPLER_SCHEMA = NodeSchemaInfo(
    input_summary=[
        {"name": "model", "kind": "required", "enum_values": None, "type": "MODEL"},
        {"name": "seed", "kind": "required", "enum_values": None, "type": "INT"},
    ],
    output_summary=[{"name": "LATENT", "type": "LATENT"}],
)
SCHEMAS = {"CheckpointLoaderSimple": CHECKPOINT_SCHEMA, "KSampler": KSAMPLER_SCHEMA}


def test_widget_params_pass_through_unchanged():
    graph = WorkflowGraph(
        nodes=[GraphNode(id="1", class_type="CheckpointLoaderSimple", params={"ckpt_name": "a.safetensors"})],
    )
    payload = compile_to_comfy_payload(graph, SCHEMAS)
    assert payload == {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "a.safetensors"}}}


def test_edge_resolves_to_source_id_and_output_index_by_name():
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="1", class_type="CheckpointLoaderSimple", params={"ckpt_name": "a.safetensors"}),
            GraphNode(id="2", class_type="KSampler", params={"seed": 1}),
        ],
        edges=[GraphEdge(id="e1", source="1", source_handle="MODEL", target="2", target_handle="model")],
    )
    payload = compile_to_comfy_payload(graph, SCHEMAS)
    # MODEL è l'output indice 0 di CheckpointLoaderSimple
    assert payload["2"]["inputs"]["model"] == ["1", 0]
    assert payload["2"]["inputs"]["seed"] == 1


def test_second_output_port_resolves_to_correct_index():
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="1", class_type="CheckpointLoaderSimple", params={}),
            GraphNode(id="2", class_type="KSampler", params={}),
        ],
        edges=[GraphEdge(id="e1", source="1", source_handle="CLIP", target="2", target_handle="model")],
    )
    payload = compile_to_comfy_payload(graph, SCHEMAS)
    assert payload["2"]["inputs"]["model"] == ["1", 1]  # CLIP è l'output indice 1


def test_raises_when_source_node_schema_unknown():
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="1", class_type="SomeUnknownLoader", params={}),
            GraphNode(id="2", class_type="KSampler", params={}),
        ],
        edges=[GraphEdge(id="e1", source="1", source_handle="MODEL", target="2", target_handle="model")],
    )
    with pytest.raises(CompileError, match="non è nell'ultimo inventario sincronizzato"):
        compile_to_comfy_payload(graph, SCHEMAS)


def test_raises_when_output_port_name_not_found():
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="1", class_type="CheckpointLoaderSimple", params={}),
            GraphNode(id="2", class_type="KSampler", params={}),
        ],
        edges=[GraphEdge(id="e1", source="1", source_handle="DOES_NOT_EXIST", target="2", target_handle="model")],
    )
    with pytest.raises(CompileError, match="non ha una porta di output"):
        compile_to_comfy_payload(graph, SCHEMAS)


def test_raises_when_edge_references_missing_node():
    graph = WorkflowGraph(
        nodes=[GraphNode(id="2", class_type="KSampler", params={})],
        edges=[GraphEdge(id="e1", source="ghost", source_handle="MODEL", target="2", target_handle="model")],
    )
    with pytest.raises(CompileError, match="nodo inesistente"):
        compile_to_comfy_payload(graph, SCHEMAS)
