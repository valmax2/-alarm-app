from __future__ import annotations

from bridge.workflow import GraphEdge, GraphNode, NodeSchemaInfo, WorkflowGraph, validate_structure

CHECKPOINT_SCHEMA = NodeSchemaInfo(
    input_summary=[{"name": "ckpt_name", "kind": "required", "type": None, "enum_values": ["a.safetensors"]}],
    output_summary=[
        {"name": "MODEL", "type": "MODEL"}, {"name": "CLIP", "type": "CLIP"}, {"name": "VAE", "type": "VAE"},
    ],
)
KSAMPLER_SCHEMA = NodeSchemaInfo(
    input_summary=[
        {"name": "model", "kind": "required", "type": "MODEL"},
        {"name": "seed", "kind": "required", "type": "INT"},
    ],
    output_summary=[{"name": "LATENT", "type": "LATENT"}],
)


def test_valid_graph_has_no_issues() -> None:
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="n1", class_type="CheckpointLoaderSimple", params={"ckpt_name": "a.safetensors"}),
            GraphNode(id="n2", class_type="KSampler", params={"seed": 1}),
        ],
        edges=[GraphEdge(id="e1", source="n1", source_handle="MODEL", target="n2", target_handle="model")],
    )
    schemas = {"CheckpointLoaderSimple": CHECKPOINT_SCHEMA, "KSampler": KSAMPLER_SCHEMA}
    assert validate_structure(graph, schemas) == []


def test_required_input_not_connected_nor_valued_is_error() -> None:
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="KSampler", params={})])
    issues = validate_structure(graph, {"KSampler": KSAMPLER_SCHEMA})
    messages = [i.message for i in issues]
    assert any("model" in m and "non collegato" in m for m in messages)
    assert any("seed" in m and "non collegato" in m for m in messages)
    assert all(i.severity == "error" for i in issues)


def test_required_input_satisfied_by_param_value_not_edge() -> None:
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="KSampler", params={"seed": 42, "model": "irrelevant"})])
    issues = validate_structure(graph, {"KSampler": KSAMPLER_SCHEMA})
    assert issues == []


def test_edge_referencing_missing_node_is_error() -> None:
    graph = WorkflowGraph(
        nodes=[GraphNode(id="n1", class_type="KSampler", params={"seed": 1, "model": "x"})],
        edges=[GraphEdge(id="e1", source="ghost", source_handle="MODEL", target="n1", target_handle="model")],
    )
    issues = validate_structure(graph, {"KSampler": KSAMPLER_SCHEMA})
    assert any("inesistente" in i.message for i in issues)


def test_cycle_is_detected() -> None:
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="n1", class_type="KSampler", params={"seed": 1, "model": "x"}),
            GraphNode(id="n2", class_type="KSampler", params={"seed": 1, "model": "x"}),
        ],
        edges=[
            GraphEdge(id="e1", source="n1", source_handle="LATENT", target="n2", target_handle="model"),
            GraphEdge(id="e2", source="n2", source_handle="LATENT", target="n1", target_handle="model"),
        ],
    )
    issues = validate_structure(graph, {"KSampler": KSAMPLER_SCHEMA})
    assert any("ciclo" in i.message for i in issues)


def test_incompatible_port_types_is_error() -> None:
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="n1", class_type="CheckpointLoaderSimple", params={"ckpt_name": "a.safetensors"}),
            GraphNode(id="n2", class_type="KSampler", params={"seed": 1}),
        ],
        # collega CLIP (output) a model (input MODEL): tipi diversi
        edges=[GraphEdge(id="e1", source="n1", source_handle="CLIP", target="n2", target_handle="model")],
    )
    issues = validate_structure(graph, {"CheckpointLoaderSimple": CHECKPOINT_SCHEMA, "KSampler": KSAMPLER_SCHEMA})
    assert any("Tipo porta incompatibile" in i.message for i in issues)


def test_unknown_node_type_is_warning_not_error() -> None:
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="SomeNodeNeverSynced", params={})])
    issues = validate_structure(graph, {})
    assert len(issues) == 1
    assert issues[0].severity == "warning"
    assert "non presente nell'ultimo inventario" in issues[0].message
