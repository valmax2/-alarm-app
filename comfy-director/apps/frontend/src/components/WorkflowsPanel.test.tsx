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
  it("mostra i workflow reali e crea/apre un nuovo workflow con la famiglia scelta", async () => {
    let workflows: Array<{ id: string; name: string; family: string | null; node_count: number; edge_count: number }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/workflows/known-families")) {
          return jsonResponse(["sdxl", "flux", "wan"]);
        }
        if (url.endsWith("/workflows") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { name: string; family: string | null };
          const created = { id: "w1", name: body.name, family: body.family, node_count: 0, edge_count: 0 };
          workflows = [...workflows, created];
          return jsonResponse({
            id: "w1", name: body.name, intent: null, family: body.family, source: "user_created",
            node_count: 0, edge_count: 0, updated_at: "2026-01-01T00:00:00Z",
          });
        }
        if (url.endsWith("/workflows/w1") && (!init || init.method === undefined)) {
          return jsonResponse({
            id: "w1", name: "Nuovo flusso", intent: null, family: "flux", source: "user_created",
            version_number: 1, graph: { nodes: [], edges: [] }, validation_issues: [],
            updated_at: "2026-01-01T00:00:00Z",
          });
        }
        if (url.endsWith("/workflows")) {
          return jsonResponse(
            workflows.map((w) => ({
              id: w.id, name: w.name, intent: null, family: w.family, source: "user_created",
              node_count: w.node_count, edge_count: w.edge_count, updated_at: "2026-01-01T00:00:00Z",
            })),
          );
        }
        return jsonResponse({});
      }),
    );

    render(<WorkflowsPanel />);
    await waitFor(() => expect(screen.getByText(/Nessun workflow ancora creato/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("option", { name: "FLUX" })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Nuovo workflow"), { target: { value: "Nuovo flusso" } });
    fireEvent.change(screen.getByLabelText("Famiglia (opzionale)"), { target: { value: "flux" } });
    fireEvent.click(screen.getByRole("button", { name: /crea e apri/i }));

    await waitFor(() => {
      expect(useWorkflowStore.getState().workflowId).toBe("w1");
    });
    await waitFor(() => {
      expect(screen.getByText(/Nuovo flusso/)).toBeInTheDocument();
      expect(screen.getByText(/FLUX/, { selector: ".models-panel__meta" })).toBeInTheDocument();
    });
  });

  it("importa un workflow da file .json e lo apre subito, segnalando i widget non mappati", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/workflows/known-families")) return jsonResponse([]);
        if (url.endsWith("/workflows/import-json")) {
          return jsonResponse({
            workflow: {
              id: "w2", name: "mio-workflow", intent: null, family: null, source: "imported_json",
              node_count: 1, edge_count: 0, updated_at: "2026-01-01T00:00:00Z",
            },
            source: "workflow",
            unmapped_widget_node_types: ["KSampler"],
          });
        }
        if (url.endsWith("/workflows/w2")) {
          return jsonResponse({
            id: "w2", name: "mio-workflow", intent: null, family: null, source: "imported_json",
            version_number: 1, graph: { nodes: [], edges: [] }, validation_issues: [],
            updated_at: "2026-01-01T00:00:00Z",
          });
        }
        if (url.endsWith("/workflows")) return jsonResponse([]);
        return jsonResponse({});
      }),
    );

    render(<WorkflowsPanel />);
    await waitFor(() => expect(screen.getByText(/Nessun workflow ancora creato/)).toBeInTheDocument());

    const file = new File([JSON.stringify({ nodes: [{ id: 1, type: "KSampler" }], links: [] })], "mio-workflow.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText(/importa da file \.json/i), { target: { files: [file] } });

    await waitFor(() => {
      expect(useWorkflowStore.getState().workflowId).toBe("w2");
    });
    await waitFor(() => {
      expect(screen.getByText(/KSampler/)).toBeInTheDocument();
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
