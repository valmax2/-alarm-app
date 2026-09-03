import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkflowStore } from "./workflowStore";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function resetStore() {
  useWorkflowStore.setState({
    workflowId: null, workflowName: null, versionNumber: null,
    nodes: [], edges: [], selectedNodeId: null, validationIssues: [],
    schemaCache: {}, loading: false, saving: false, error: null, past: [], future: [],
  });
}

beforeEach(resetStore);
afterEach(() => {
  vi.unstubAllGlobals();
  resetStore();
});

describe("workflowStore", () => {
  it("addNode legge lo schema reale e crea un nodo con i default corretti (widget sì, socket no)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/inventory/nodes/KSampler/schema")) {
          return jsonResponse({
            class_type: "KSampler", display_name: "KSampler", category: "sampling", is_custom_node: false,
            input_summary: [
              { name: "seed", kind: "required", enum_values: null, type: "INT", default: 42, min: 0, max: 100, step: 1 },
              { name: "model", kind: "required", enum_values: null, type: "MODEL", default: null, min: null, max: null, step: null },
            ],
            output_summary: [{ name: "LATENT", type: "LATENT" }],
          });
        }
        return jsonResponse({});
      }),
    );

    await useWorkflowStore.getState().addNode("KSampler", { x: 10, y: 20 });

    const state = useWorkflowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].data.classType).toBe("KSampler");
    expect(state.nodes[0].data.params.seed).toBe(42); // widget INT: default preso dallo schema
    expect(state.nodes[0].data.params.model).toBeUndefined(); // socket MODEL: nessun valore diretto
    expect(state.past).toHaveLength(1); // la mutazione finisce nello storico undo
  });

  it("onConnect collega due nodi; removeNode rimuove il nodo e gli archi collegati", () => {
    useWorkflowStore.setState({
      nodes: [
        { id: "n1", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "A", displayName: "A", params: {} } },
        { id: "n2", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "B", displayName: "B", params: {} } },
      ],
    });

    useWorkflowStore.getState().onConnect({ source: "n1", sourceHandle: "OUT", target: "n2", targetHandle: "IN" });
    expect(useWorkflowStore.getState().edges).toHaveLength(1);

    useWorkflowStore.getState().removeNode("n1");
    const state = useWorkflowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe("n2");
    expect(state.edges).toHaveLength(0);
  });

  it("updateNodeParam cambia solo il nodo interessato", () => {
    useWorkflowStore.setState({
      nodes: [
        { id: "n1", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "A", displayName: "A", params: { x: 1 } } },
        { id: "n2", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "B", displayName: "B", params: { x: 1 } } },
      ],
    });
    useWorkflowStore.getState().updateNodeParam("n1", "x", 99);
    const state = useWorkflowStore.getState();
    expect(state.nodes.find((n) => n.id === "n1")?.data.params.x).toBe(99);
    expect(state.nodes.find((n) => n.id === "n2")?.data.params.x).toBe(1);
  });

  it("undo/redo ripristinano correttamente lo stato precedente/successivo", () => {
    useWorkflowStore.setState({
      nodes: [{ id: "n1", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "A", displayName: "A", params: {} } }],
    });

    useWorkflowStore.getState().updateNodeParam("n1", "foo", "bar");
    expect(useWorkflowStore.getState().nodes[0].data.params.foo).toBe("bar");

    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().nodes[0].data.params.foo).toBeUndefined();

    useWorkflowStore.getState().redo();
    expect(useWorkflowStore.getState().nodes[0].data.params.foo).toBe("bar");
  });

  it("cancellare un nodo isolato con Backspace/Canc (onNodesChange) resta annullabile con Undo — bug reale trovato in audit", () => {
    useWorkflowStore.setState({
      nodes: [{ id: "n1", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "A", displayName: "A", params: {} } }],
      edges: [], // nessun arco collegato: React Flow non passa da onEdgesChange in questo caso
    });

    // Simula esattamente il NodeChange che React Flow emette per il tasto Canc/Backspace.
    useWorkflowStore.getState().onNodesChange([{ type: "remove", id: "n1" }]);
    expect(useWorkflowStore.getState().nodes).toHaveLength(0);

    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    expect(useWorkflowStore.getState().nodes[0].id).toBe("n1");
  });

  it("spostare un nodo (drag, onNodesChange senza rimozioni) non intasa lo storico Undo", () => {
    useWorkflowStore.setState({
      nodes: [{ id: "n1", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "A", displayName: "A", params: {} } }],
    });
    useWorkflowStore.getState().onNodesChange([{ type: "position", id: "n1", position: { x: 50, y: 50 } }]);
    expect(useWorkflowStore.getState().past).toHaveLength(0);
  });

  it("openWorkflow carica il grafo dal Bridge; save() lo rimanda indietro nello stesso formato (DoD Fase 3)", async () => {
    let savedPayload: { graph: { nodes: unknown[]; edges: unknown[] } } | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/inventory/nodes/KSampler/schema")) {
          return jsonResponse({
            class_type: "KSampler", display_name: "KSampler", category: "s", is_custom_node: false,
            input_summary: [], output_summary: [],
          });
        }
        if (url.endsWith("/workflows/w1") && init?.method === "PUT") {
          savedPayload = JSON.parse(init.body as string);
          return jsonResponse({
            id: "w1", name: "Test", intent: null, family: null, source: "user_created", version_number: 2,
            graph: savedPayload!.graph, validation_issues: [], updated_at: "2026-01-01T00:00:01Z",
          });
        }
        if (url.endsWith("/workflows/w1")) {
          return jsonResponse({
            id: "w1", name: "Test", intent: null, family: null, source: "user_created", version_number: 1,
            graph: {
              nodes: [{ id: "n1", class_type: "KSampler", position: { x: 5, y: 5 }, params: { seed: 1 } }],
              edges: [],
            },
            validation_issues: [], updated_at: "2026-01-01T00:00:00Z",
          });
        }
        return jsonResponse({});
      }),
    );

    await useWorkflowStore.getState().openWorkflow("w1");
    const loaded = useWorkflowStore.getState();
    expect(loaded.workflowId).toBe("w1");
    expect(loaded.nodes).toHaveLength(1);
    expect(loaded.nodes[0].position).toEqual({ x: 5, y: 5 });
    expect(loaded.nodes[0].data.params).toEqual({ seed: 1 });

    await useWorkflowStore.getState().save();

    expect(savedPayload).not.toBeNull();
    expect(savedPayload!.graph.nodes[0]).toEqual({
      id: "n1", class_type: "KSampler", position: { x: 5, y: 5 }, params: { seed: 1 },
    });
    expect(useWorkflowStore.getState().versionNumber).toBe(2);
  });

  it("closeWorkflow riporta lo store allo stato vuoto", async () => {
    useWorkflowStore.setState({ workflowId: "w1", workflowName: "Test", nodes: [], edges: [] });
    useWorkflowStore.getState().closeWorkflow();
    expect(useWorkflowStore.getState().workflowId).toBeNull();
    expect(useWorkflowStore.getState().workflowName).toBeNull();
  });
});
