from __future__ import annotations

from bridge.workflow import GraphEdge, GraphNode, NodeSchemaInfo, WorkflowGraph, find_prompt_targets

CLIP_TEXT_ENCODE = NodeSchemaInfo(
    input_summary=[
        {"name": "text", "kind": "required", "enum_values": None, "type": "STRING"},
        {"name": "clip", "kind": "required", "enum_values": None, "type": "CLIP"},
    ],
    output_summary=[{"name": "CONDITIONING", "type": "CONDITIONING"}],
)
KSAMPLER = NodeSchemaInfo(
    input_summary=[
        {"name": "model", "kind": "required", "enum_values": None, "type": "MODEL"},
        {"name": "positive", "kind": "required", "enum_values": None, "type": "CONDITIONING"},
        {"name": "negative", "kind": "required", "enum_values": None, "type": "CONDITIONING"},
        {"name": "seed", "kind": "required", "enum_values": None, "type": "INT"},
    ],
    output_summary=[{"name": "LATENT", "type": "LATENT"}],
)
CHECKPOINT = NodeSchemaInfo(
    input_summary=[{"name": "ckpt_name", "kind": "required", "enum_values": ["a.safetensors"], "type": None}],
    output_summary=[{"name": "MODEL", "type": "MODEL"}, {"name": "CLIP", "type": "CLIP"}],
)
# Nodo custom di fantasia con due campi di testo libero — deliberatamente ambiguo.
DUAL_TEXT_ENCODE = NodeSchemaInfo(
    input_summary=[
        {"name": "text_g", "kind": "required", "enum_values": None, "type": "STRING"},
        {"name": "text_l", "kind": "required", "enum_values": None, "type": "STRING"},
        {"name": "clip", "kind": "required", "enum_values": None, "type": "CLIP"},
    ],
    output_summary=[{"name": "CONDITIONING", "type": "CONDITIONING"}],
)
SCHEMAS = {
    "CLIPTextEncode": CLIP_TEXT_ENCODE,
    "KSampler": KSAMPLER,
    "CheckpointLoaderSimple": CHECKPOINT,
    "CLIPTextEncodeSDXL": DUAL_TEXT_ENCODE,
}


def _basic_graph(*, with_negative: bool = True) -> WorkflowGraph:
    edges = [
        GraphEdge(id="e-pos", source="pos", source_handle="CONDITIONING", target="sampler", target_handle="positive"),
        GraphEdge(id="e-model", source="ckpt", source_handle="MODEL", target="sampler", target_handle="model"),
    ]
    if with_negative:
        edges.append(
            GraphEdge(id="e-neg", source="neg", source_handle="CONDITIONING", target="sampler", target_handle="negative")
        )
    nodes = [
        GraphNode(id="ckpt", class_type="CheckpointLoaderSimple", params={"ckpt_name": "a.safetensors"}),
        GraphNode(id="pos", class_type="CLIPTextEncode", params={"text": "old positive"}),
        GraphNode(id="sampler", class_type="KSampler", params={"seed": 1}),
    ]
    if with_negative:
        nodes.append(GraphNode(id="neg", class_type="CLIPTextEncode", params={"text": "old negative"}))
    return WorkflowGraph(nodes=nodes, edges=edges)


def test_finds_positive_and_negative_text_targets_via_graph_structure():
    result = find_prompt_targets(_basic_graph(), SCHEMAS)
    assert result.positive is not None
    assert result.positive.node_id == "pos"
    assert result.positive.param_name == "text"
    assert result.negative is not None
    assert result.negative.node_id == "neg"
    assert result.negative.param_name == "text"
    assert result.issues == []


def test_missing_negative_edge_is_not_an_issue_only_positive_is_required():
    result = find_prompt_targets(_basic_graph(with_negative=False), SCHEMAS)
    assert result.positive is not None
    assert result.negative is None
    assert result.issues == []


def test_no_positive_edge_at_all_is_a_declared_issue_never_a_guess():
    graph = WorkflowGraph(
        nodes=[GraphNode(id="1", class_type="CheckpointLoaderSimple", params={})],
        edges=[],
    )
    result = find_prompt_targets(graph, SCHEMAS)
    assert result.positive is None
    assert any("Nessun arco" in issue for issue in result.issues)


def test_positive_source_node_schema_unknown_is_a_declared_issue():
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="pos", class_type="MysteryCustomNode", params={"text": "x"}),
            GraphNode(id="sampler", class_type="KSampler", params={}),
        ],
        edges=[GraphEdge(id="e1", source="pos", source_handle="CONDITIONING", target="sampler", target_handle="positive")],
    )
    result = find_prompt_targets(graph, SCHEMAS)
    assert result.positive is None
    assert any("non è nell'ultimo inventario sincronizzato" in issue for issue in result.issues)


def test_positive_source_with_two_string_fields_is_ambiguous_never_guessed():
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="pos", class_type="CLIPTextEncodeSDXL", params={"text_g": "a", "text_l": "b"}),
            GraphNode(id="sampler", class_type="KSampler", params={}),
        ],
        edges=[GraphEdge(id="e1", source="pos", source_handle="CONDITIONING", target="sampler", target_handle="positive")],
    )
    result = find_prompt_targets(graph, SCHEMAS)
    assert result.positive is None
    assert any("ambiguo" in issue for issue in result.issues)


def test_positive_source_with_zero_free_text_fields_is_a_declared_issue():
    # Un nodo il cui unico input STRING è già alimentato da un arco (quindi non un
    # widget di testo libero) non ha nessun campo su cui scrivere.
    schemas = dict(SCHEMAS)
    schemas["TextFromSomewhereElse"] = NodeSchemaInfo(
        input_summary=[{"name": "text", "kind": "required", "enum_values": None, "type": "STRING"}],
        output_summary=[{"name": "CONDITIONING", "type": "CONDITIONING"}],
    )
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="upstream", class_type="CheckpointLoaderSimple", params={}),
            GraphNode(id="pos", class_type="TextFromSomewhereElse", params={}),
            GraphNode(id="sampler", class_type="KSampler", params={}),
        ],
        edges=[
            GraphEdge(id="e0", source="upstream", source_handle="MODEL", target="pos", target_handle="text"),
            GraphEdge(id="e1", source="pos", source_handle="CONDITIONING", target="sampler", target_handle="positive"),
        ],
    )
    result = find_prompt_targets(graph, schemas)
    assert result.positive is None
    assert any("non ha nessun campo di testo libero" in issue for issue in result.issues)


def test_positive_edge_targeting_missing_node_is_a_declared_issue():
    graph = WorkflowGraph(
        nodes=[GraphNode(id="sampler", class_type="KSampler", params={})],
        edges=[GraphEdge(id="e1", source="ghost", source_handle="CONDITIONING", target="sampler", target_handle="positive")],
    )
    result = find_prompt_targets(graph, SCHEMAS)
    assert result.positive is None
    assert any("nodo inesistente" in issue for issue in result.issues)
