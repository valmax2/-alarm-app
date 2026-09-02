import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BridgeStatus } from "./BridgeStatus";

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BridgeStatus", () => {
  it("mostra 'Bridge non raggiungibile' quando /health fallisce", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    render(<BridgeStatus />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Bridge non raggiungibile");
    });
  });

  it("mostra 'ComfyUI offline' con il motivo quando il Bridge risponde ma ComfyUI no", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/health")) {
          return jsonResponse({ status: "ok", version: "0.1.0", time: "2026-01-01T00:00:00Z" });
        }
        return jsonResponse({
          status: "offline",
          reason: "ComfyUI non raggiungibile su questo indirizzo",
          base_url: "http://127.0.0.1:8188",
          version: null,
          os: null,
          python_version: null,
          pytorch_version: null,
          checked_at: "2026-01-01T00:00:00Z",
        });
      }),
    );

    render(<BridgeStatus />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("ComfyUI offline");
      expect(screen.getByRole("status")).toHaveTextContent("non raggiungibile su questo indirizzo");
    });
  });

  it("mostra 'ComfyUI online' con la versione quando entrambi rispondono", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/health")) {
          return jsonResponse({ status: "ok", version: "0.1.0", time: "2026-01-01T00:00:00Z" });
        }
        return jsonResponse({
          status: "online",
          reason: null,
          base_url: "http://127.0.0.1:8188",
          version: "0.3.12",
          os: "posix",
          python_version: "3.11.9",
          pytorch_version: "2.4.0",
          checked_at: "2026-01-01T00:00:00Z",
        });
      }),
    );

    render(<BridgeStatus />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("ComfyUI online");
      expect(screen.getByRole("status")).toHaveTextContent("v0.3.12");
    });
  });
});
