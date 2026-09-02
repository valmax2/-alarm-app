import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "./SettingsPanel";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPanel", () => {
  it("carica l'URL corrente e salva un nuovo valore (+ percorso ComfyUI) chiamando PUT /settings", async () => {
    let stored = { comfy_base_url: "http://127.0.0.1:8188", comfy_root_path: null as string | null };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        stored = JSON.parse(init.body as string) as typeof stored;
        return jsonResponse(stored);
      }
      if (url.endsWith("/settings")) return jsonResponse(stored);
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPanel />);

    const urlInput = await screen.findByLabelText<HTMLInputElement>("URL ComfyUI");
    const pathInput = screen.getByLabelText<HTMLInputElement>(/percorso installazione comfyui/i);
    await waitFor(() => expect(urlInput.value).toBe("http://127.0.0.1:8188"));

    fireEvent.change(urlInput, { target: { value: "http://192.168.1.50:8188" } });
    fireEvent.change(pathInput, { target: { value: "/data/ComfyUI" } });
    fireEvent.click(screen.getByRole("button", { name: /^salva$/i }));

    await waitFor(() => {
      expect(screen.getByText("Impostazioni salvate.")).toBeInTheDocument();
    });
    expect(stored).toEqual({ comfy_base_url: "http://192.168.1.50:8188", comfy_root_path: "/data/ComfyUI" });
  });

  it("premendo Sincronizza ComfyUI chiama POST /comfy/sync e mostra il report reale", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/settings")) {
        return jsonResponse({ comfy_base_url: "http://127.0.0.1:8188", comfy_root_path: null });
      }
      if (url.endsWith("/comfy/sync") && init?.method === "POST") {
        return jsonResponse({
          comfy_status: "online",
          comfy_version: "0.3.12",
          node_count: 5,
          custom_node_count: 1,
          model_count: 3,
          model_counts_by_type: { checkpoint: 2, lora: 1 },
          filesystem_scan_used: false,
          synced_at: "2026-01-01T00:00:00Z",
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPanel />);
    await screen.findByLabelText<HTMLInputElement>("URL ComfyUI");

    fireEvent.click(screen.getByRole("button", { name: /sincronizza comfyui/i }));

    await waitFor(() => {
      expect(screen.getByText(/Online \(v0\.3\.12\)/)).toBeInTheDocument();
    });
    expect(screen.getByText("5")).toBeInTheDocument(); // node_count
  });

  it("mostra l'errore reale quando la sincronizzazione fallisce (ComfyUI offline)", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/settings")) {
        return jsonResponse({ comfy_base_url: "http://127.0.0.1:8188", comfy_root_path: null });
      }
      if (url.endsWith("/comfy/sync") && init?.method === "POST") {
        return jsonResponse({ detail: "ComfyUI non raggiungibile su http://127.0.0.1:8188" }, 503);
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPanel />);
    await screen.findByLabelText<HTMLInputElement>("URL ComfyUI");

    fireEvent.click(screen.getByRole("button", { name: /sincronizza comfyui/i }));

    await waitFor(() => {
      expect(screen.getByText(/ComfyUI non raggiungibile/)).toBeInTheDocument();
    });
  });
});
