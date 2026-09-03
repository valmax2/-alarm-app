import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkflowFromImagePanel } from "./WorkflowFromImagePanel";
import { useWorkflowStore } from "../store/workflowStore";

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

function makeFile(name = "test.png"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  useWorkflowStore.setState({ workflowId: null, workflowName: null, versionNumber: null, nodes: [], edges: [] });
});

describe("WorkflowFromImagePanel", () => {
  it("mostra il messaggio onesto quando il workflow non è trovato nei metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          found: false, source: null, node_count: 0, link_count: 0, nodes: [],
          missing_node_types: [], inventory_checked: false,
          message: "Workflow ComfyUI non trovato nei metadata. Vuoi analizzare l'immagine per ricavarne un prompt?",
        }),
      ),
    );

    render(<WorkflowFromImagePanel />);
    const input = screen.getByLabelText<HTMLInputElement>("Carica immagine");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      expect(screen.getByText(/non trovato nei metadata/)).toBeInTheDocument();
    });
  });

  it("mostra i nodi trovati e segnala quelli non installati", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          found: true, source: "workflow", node_count: 2, link_count: 1,
          nodes: [
            { id: "1", class_type: "CheckpointLoaderSimple", title: "Load Checkpoint", present_in_inventory: true },
            { id: "2", class_type: "SomeCustomNode", title: null, present_in_inventory: false },
          ],
          missing_node_types: ["SomeCustomNode"], inventory_checked: true,
          message: "Workflow trovato: 2 nodi, 1 collegamenti. 1 tipi di nodo non risultano installati.",
        }),
      ),
    );

    render(<WorkflowFromImagePanel />);
    const input = screen.getByLabelText<HTMLInputElement>("Carica immagine");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      expect(screen.getByText("Load Checkpoint")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/SomeCustomNode/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Componenti non installati/)).toBeInTheDocument();
    expect(screen.getByText(/NON installato/)).toBeInTheDocument();
  });

  it("quando il Bridge apre davvero un workflow, lo carica sulla canvas (bug corretto in audit)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/workflow-import/from-image")) {
          return jsonResponse({
            found: true, source: "workflow", node_count: 2, link_count: 1, nodes: [],
            missing_node_types: [], inventory_checked: true,
            message: "Workflow trovato: 2 nodi, 1 collegamenti. Aperto in canvas come nuovo workflow.",
            workflow: {
              id: "w-from-image", name: "mio-flusso", intent: null, family: null,
              source: "imported_json", node_count: 2, edge_count: 1, updated_at: "2026-01-01T00:00:00Z",
            },
          });
        }
        if (url.endsWith("/workflows/w-from-image")) {
          return jsonResponse({
            id: "w-from-image", name: "mio-flusso", intent: null, family: null, source: "imported_json",
            version_number: 1,
            graph: {
              nodes: [
                { id: "1", class_type: "CheckpointLoaderSimple", position: { x: 0, y: 0 }, params: {} },
                { id: "2", class_type: "KSampler", position: { x: 200, y: 0 }, params: {} },
              ],
              edges: [{ id: "e1", source: "1", source_handle: "MODEL", target: "2", target_handle: "model" }],
            },
            validation_issues: [], updated_at: "2026-01-01T00:00:00Z",
          });
        }
        return jsonResponse({});
      }),
    );

    render(<WorkflowFromImagePanel />);
    const input = screen.getByLabelText<HTMLInputElement>("Carica immagine");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      expect(screen.getByText(/Aperto sulla canvas come "mio-flusso"/)).toBeInTheDocument();
    });
    // non solo il messaggio: il workflow è DAVVERO nello store che alimenta la canvas.
    await waitFor(() => {
      expect(useWorkflowStore.getState().workflowId).toBe("w-from-image");
      expect(useWorkflowStore.getState().nodes).toHaveLength(2);
    });
  });
});
