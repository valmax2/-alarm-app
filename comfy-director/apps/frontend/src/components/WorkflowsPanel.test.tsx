import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWorkflowStore } from "../store/workflowStore";
import { WorkflowsPanel } from "./WorkflowsPanel";

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  cleanup(); // smonta prima di toccare lo store globale, evita update fuori da act() sul test successivo
  vi.unstubAllGlobals();
  useWorkflowStore.setState({ workflowId: null, workflowName: null, nodes: [], edges: [], error: null, loading: false });
});

describe("WorkflowsPanel", () => {
  it("mostra i workflow reali e crea/apre un nuovo workflow", async () => {
    let workflows: Array<{ id: string; name: string; node_count: number; edge_count: number }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/workflows") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { name: string };
          const created = { id: "w1", name: body.name, node_count: 0, edge_count: 0 };
          workflows = [...workflows, created];
          return jsonResponse({
            id: "w1", name: body.name, intent: null, family: null, source: "user_created",
            node_count: 0, edge_count: 0, updated_at: "2026-01-01T00:00:00Z",
          });
        }
        if (url.endsWith("/workflows/w1") && (!init || init.method === undefined)) {
          return jsonResponse({
            id: "w1", name: "Nuovo flusso", intent: null, family: null, source: "user_created",
            version_number: 1, graph: { nodes: [], edges: [] }, validation_issues: [],
            updated_at: "2026-01-01T00:00:00Z",
          });
        }
        if (url.endsWith("/workflows")) {
          return jsonResponse(
            workflows.map((w) => ({
              id: w.id, name: w.name, intent: null, family: null, source: "user_created",
              node_count: w.node_count, edge_count: w.edge_count, updated_at: "2026-01-01T00:00:00Z",
            })),
          );
        }
        return jsonResponse({});
      }),
    );

    render(<WorkflowsPanel />);
    await waitFor(() => expect(screen.getByText(/Nessun workflow ancora creato/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Nuovo workflow"), { target: { value: "Nuovo flusso" } });
    fireEvent.click(screen.getByRole("button", { name: /crea e apri/i }));

    await waitFor(() => {
      expect(useWorkflowStore.getState().workflowId).toBe("w1");
    });
    await waitFor(() => {
      expect(screen.getByText(/Nuovo flusso/)).toBeInTheDocument();
    });
  });

  it("mostra gli errori di validazione del workflow aperto", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse([])));
    useWorkflowStore.setState({
      workflowId: "w1",
      validationIssues: [{ severity: "error", node_id: "n1", message: "Input richiesto 'model' non collegato" }],
    });

    render(<WorkflowsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Input richiesto 'model' non collegato/)).toBeInTheDocument();
    });
  });
});
