import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromptFromImagePanel } from "./PromptFromImagePanel";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function makeFile(name = "photo.png"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PromptFromImagePanel", () => {
  it("mostra 'nessun provider configurato' quando la lista è vuota", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse([])));
    render(<PromptFromImagePanel />);
    await waitFor(() => {
      expect(screen.getByText(/Nessun provider configurato/)).toBeInTheDocument();
    });
  });

  it("analizza l'immagine con il provider selezionato e mostra il prompt strutturato", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/ai-providers") && (!init || init.method === undefined)) {
        return jsonResponse([
          {
            id: "p1", kind: "anthropic", label: "Claude", base_url: null, default_model: null,
            enabled: true, has_api_key: true, created_at: "2026-01-01T00:00:00Z",
          },
        ]);
      }
      if (url.endsWith("/prompt-from-image/analyze")) {
        return jsonResponse({
          provider_id: "p1", provider_kind: "anthropic",
          structured: {
            subject: "a cat", identity: "n/a", hair: "n/a", face: "n/a", body_clothing: "n/a",
            pose_action: "sitting", environment: "windowsill", camera: "close-up", light: "sunlight",
            style: "photorealistic", details: "whiskers", final_prompt_en: "a photorealistic cat sitting on a windowsill",
          },
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PromptFromImagePanel />);
    await waitFor(() => expect(screen.getAllByText("Claude").length).toBeGreaterThan(0));

    const input = screen.getByLabelText<HTMLInputElement>("Carica immagine da analizzare");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      expect(screen.getByText("a cat")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("a photorealistic cat sitting on a windowsill")).toBeInTheDocument();
  });

  it("aggiunge un nuovo provider chiamando POST /ai-providers", async () => {
    let created = false;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/ai-providers") && init?.method === "POST") {
        created = true;
        const body = JSON.parse(init.body as string) as { kind: string; label: string; api_key?: string };
        expect(body.kind).toBe("anthropic");
        expect(body.api_key).toBe("sk-test-123");
        return jsonResponse({
          id: "new-id", kind: "anthropic", label: body.label, base_url: null, default_model: null,
          enabled: true, has_api_key: true, created_at: "2026-01-01T00:00:00Z",
        });
      }
      if (url.endsWith("/ai-providers")) {
        return jsonResponse(
          created
            ? [
                {
                  id: "new-id", kind: "anthropic", label: "Il mio provider", base_url: null, default_model: null,
                  enabled: true, has_api_key: true, created_at: "2026-01-01T00:00:00Z",
                },
              ]
            : [],
        );
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PromptFromImagePanel />);
    await waitFor(() => expect(screen.getByText(/Nessun provider configurato/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /aggiungi provider/i }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Il mio provider" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "sk-test-123" } });
    fireEvent.click(screen.getByRole("button", { name: /^salva provider$/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Il mio provider").length).toBeGreaterThan(0);
    });
  });
});
