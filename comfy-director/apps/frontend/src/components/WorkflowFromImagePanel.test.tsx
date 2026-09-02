import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkflowFromImagePanel } from "./WorkflowFromImagePanel";

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

function makeFile(name = "test.png"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

afterEach(() => {
  vi.unstubAllGlobals();
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
});
