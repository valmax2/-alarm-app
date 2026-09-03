from __future__ import annotations

from bridge.workflow import GraphEdge, GraphNode, NodeSchemaInfo, WorkflowGraph, find_image_widget

LOAD_IMAGE = NodeSchemaInfo(
    input_summary=[
        {"name": "image", "kind": "required", "enum_values": ["a.png"], "type": None, "image_upload": True},
    ],
    output_summary=[{"name": "IMAGE", "type": "IMAGE"}, {"name": "MASK", "type": "MASK"}],
)
KSAMPLER = NodeSchemaInfo(
    input_summary=[{"name": "sampler_name", "kind": "required", "enum_values": ["euler"], "type": None, "image_upload": False}],
    output_summary=[{"name": "LATENT", "type": "LATENT"}],
)
# Nodo di fantasia con due campi immagine caricabile — deliberatamente ambiguo.
DUAL_IMAGE_NODE = NodeSchemaInfo(
    input_summary=[
        {"name": "image_a", "kind": "required", "enum_values": ["a.png"], "type": None, "image_upload": True},
        {"name": "image_b", "kind": "required", "enum_values": ["b.png"], "type": None, "image_upload": True},
    ],
    output_summary=[{"name": "IMAGE", "type": "IMAGE"}],
)
SCHEMAS = {"LoadImage": LOAD_IMAGE, "KSampler": KSAMPLER, "DualImageNode": DUAL_IMAGE_NODE}


def test_finds_the_single_image_upload_field_on_a_load_image_node() -> None:
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="LoadImage", params={"image": "old.png"})])
    target, issue = find_image_widget(graph, graph.nodes[0], SCHEMAS)
    assert issue is None
    assert target is not None
    assert target.param_name == "image"


def test_a_node_without_an_image_upload_field_is_a_declared_issue_never_a_guess() -> None:
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="KSampler", params={})])
    target, issue = find_image_widget(graph, graph.nodes[0], SCHEMAS)
    assert target is None
    assert "non ha nessun campo" in issue


def test_plain_enum_field_is_never_treated_as_an_image_upload_field() -> None:
    # sampler_name è un enum come "image", ma senza il flag reale image_upload:
    # deve restare fuori — mai un abbinamento indovinato dal solo tipo enum.
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="KSampler", params={})])
    target, _ = find_image_widget(graph, graph.nodes[0], SCHEMAS)
    assert target is None


def test_a_node_with_two_image_upload_fields_is_ambiguous_never_guessed() -> None:
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="DualImageNode", params={})])
    target, issue = find_image_widget(graph, graph.nodes[0], SCHEMAS)
    assert target is None
    assert "ambiguo" in issue


def test_unknown_node_schema_is_a_declared_issue() -> None:
    graph = WorkflowGraph(nodes=[GraphNode(id="n1", class_type="MysteryCustomNode", params={})])
    target, issue = find_image_widget(graph, graph.nodes[0], SCHEMAS)
    assert target is None
    assert "non è nell'ultimo inventario sincronizzato" in issue


def test_an_image_field_already_fed_by_an_edge_is_not_a_free_widget() -> None:
    graph = WorkflowGraph(
        nodes=[
            GraphNode(id="upstream", class_type="KSampler", params={}),
            GraphNode(id="n1", class_type="LoadImage", params={}),
        ],
        edges=[GraphEdge(id="e1", source="upstream", source_handle="LATENT", target="n1", target_handle="image")],
    )
    target, issue = find_image_widget(graph, graph.nodes[1], SCHEMAS)
    assert target is None
    assert "non ha nessun campo" in issue
