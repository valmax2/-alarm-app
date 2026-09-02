import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiagnosticsPanel } from "./DiagnosticsPanel";

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DiagnosticsPanel", () => {
  it("mostra un messaggio rassicurante quando non ci sono errori", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse([])));
    render(<DiagnosticsPanel />);
    await waitFor(() => expect(screen.getByText(/Nessun errore registrato/)).toBeInTheDocument());
  });

  it("mostra gli errori reali persistiti dal Bridge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse([
          {
            id: "e1", level: "error", source: "GET /workflows",
            message: "qualcosa è andato storto", context: null, created_at: "2026-01-01T00:00:00Z",
          },
        ]),
      ),
    );
    render(<DiagnosticsPanel />);
    await waitFor(() => {
      expect(screen.getByText("GET /workflows")).toBeInTheDocument();
      expect(screen.getByText("qualcosa è andato storto")).toBeInTheDocument();
    });
  });
});
