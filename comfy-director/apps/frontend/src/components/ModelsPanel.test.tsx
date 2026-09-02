import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelsPanel } from "./ModelsPanel";

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

const ALL_MODELS = [
  {
    id: "1", name: "flux1-dev.safetensors", path: "checkpoints/flux1-dev.safetensors", model_type: "checkpoint",
    extension: "safetensors", size_bytes: 100, family: "flux", detection_confidence: 0.9,
    detection_source: "metadata", last_seen: "2026-01-01T00:00:00Z", compatibility: null, compatibility_reason: null,
  },
  {
    id: "2", name: "sd_xl_base_1.0.safetensors", path: "checkpoints/sd_xl_base_1.0.safetensors", model_type: "checkpoint",
    extension: "safetensors", size_bytes: 200, family: "sdxl", detection_confidence: 0.9,
    detection_source: "metadata", last_seen: "2026-01-01T00:00:00Z", compatibility: null, compatibility_reason: null,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ModelsPanel", () => {
  it("mostra l'inventario reale e filtra per famiglia mostrando la compatibilità", async () => {
    const fetchMock = vi.fn((url: string) => {
      const parsed = new URL(url, "http://bridge.local");
      if (parsed.searchParams.get("family") === "flux") {
        return jsonResponse([
          { ...ALL_MODELS[0], compatibility: "compatible", compatibility_reason: "Famiglia corrisponde" },
        ]);
      }
      return jsonResponse(ALL_MODELS);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelsPanel />);

    await screen.findByText("flux1-dev.safetensors");
    expect(screen.getByText("sd_xl_base_1.0.safetensors")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Famiglia"), { target: { value: "flux" } });

    await waitFor(() => {
      expect(screen.queryByText("sd_xl_base_1.0.safetensors")).not.toBeInTheDocument();
    });
    expect(screen.getByText("flux1-dev.safetensors")).toBeInTheDocument();
    expect(screen.getByText("✅ Compatibile")).toBeInTheDocument();
  });

  it("mostra un messaggio chiaro quando l'inventario è vuoto (nessuna sync fatta)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse([])));
    render(<ModelsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Nessun modello in inventario/)).toBeInTheDocument();
    });
  });
});
