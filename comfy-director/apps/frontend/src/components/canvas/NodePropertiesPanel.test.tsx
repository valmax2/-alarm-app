import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useWorkflowStore } from "../../store/workflowStore";
import { NodePropertiesPanel } from "./NodePropertiesPanel";

const SCHEMA = {
  class_type: "KSampler", display_name: "KSampler", category: "sampling", is_custom_node: false,
  input_summary: [
    { name: "seed", kind: "required" as const, enum_values: null, type: "INT", default: 0, min: 0, max: 100, step: 1 },
    { name: "model", kind: "required" as const, enum_values: null, type: "MODEL", default: null, min: null, max: null, step: null },
  ],
  output_summary: [{ name: "LATENT", type: "LATENT" }],
};

function seedStore() {
  useWorkflowStore.setState({
    nodes: [
      { id: "n1", type: "comfyNode", position: { x: 0, y: 0 }, data: { classType: "KSampler", displayName: "KSampler", params: { seed: 5 } } },
    ],
    edges: [],
    selectedNodeId: "n1",
    schemaCache: { KSampler: SCHEMA },
  });
}

afterEach(() => {
  cleanup(); // smonta prima di toccare lo store globale, evita update fuori da act() sul test successivo
  useWorkflowStore.setState({
    nodes: [], edges: [], selectedNodeId: null, schemaCache: {}, past: [], future: [],
  });
});

describe("NodePropertiesPanel", () => {
  it("mostra i widget reali del nodo e aggiorna il valore quando li modifichi", () => {
    seedStore();
    render(<NodePropertiesPanel />);

    const seedInput = screen.getByLabelText("seed") as HTMLInputElement;
    expect(seedInput.value).toBe("5");

    fireEvent.change(seedInput, { target: { value: "42" } });
    expect(useWorkflowStore.getState().nodes[0].data.params.seed).toBe(42);
  });

  it("mostra gli ingressi socket come collegato/non collegato, mai come widget editabile", () => {
    seedStore();
    render(<NodePropertiesPanel />);
    expect(screen.getByText("model")).toBeInTheDocument();
    expect(screen.getByText("non collegato")).toBeInTheDocument();
    expect(screen.queryByLabelText("model")).not.toBeInTheDocument();
  });

  it("elimina il nodo e lo deseleziona", () => {
    seedStore();
    render(<NodePropertiesPanel />);
    fireEvent.click(screen.getByRole("button", { name: /elimina nodo/i }));
    expect(useWorkflowStore.getState().nodes).toHaveLength(0);
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
  });

  it("non renderizza nulla quando nessun nodo è selezionato", () => {
    const { container } = render(<NodePropertiesPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
