import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NodesPanel } from "./NodesPanel";

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NodesPanel", () => {
  it("mostra i nodi reali dell'inventario, distinguendo core da custom", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse([
          {
            class_type: "CheckpointLoaderSimple", display_name: "Load Checkpoint", category: "loaders",
            is_custom_node: false, last_seen: "2026-01-01T00:00:00Z",
          },
          {
            class_type: "SomeCommunityNode", display_name: "Some Community Node", category: "ipadapter",
            is_custom_node: true, last_seen: "2026-01-01T00:00:00Z",
          },
        ]),
      ),
    );

    render(<NodesPanel />);

    await screen.findByText("Load Checkpoint");
    expect(screen.getByText(/CheckpointLoaderSimple.*core/)).toBeInTheDocument();
    expect(screen.getByText(/SomeCommunityNode.*custom node/)).toBeInTheDocument();
  });
});
