import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CharactersPanel } from "./CharactersPanel";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CharactersPanel", () => {
  it("mostra i personaggi reali e ne crea uno nuovo", async () => {
    let characters: Array<{ id: string; name: string; description: null; tags: string[]; is_private: boolean; image_count: number; main_image_id: null; created_at: string; updated_at: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/characters") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { name: string };
          const created = {
            id: "c1", name: body.name, description: null, tags: [], is_private: false,
            image_count: 0, main_image_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
          };
          characters = [...characters, created];
          return jsonResponse(created);
        }
        if (url.endsWith("/characters/c1")) {
          return jsonResponse({
            id: "c1", name: "Elena", description: null, tags: [], is_private: false, image_count: 0,
            main_image_id: null, notes: null, images: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
          });
        }
        if (url.endsWith("/characters")) return jsonResponse(characters);
        return jsonResponse({});
      }),
    );

    render(<CharactersPanel />);
    await waitFor(() => expect(screen.getByText(/Nessun personaggio ancora creato/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Nuovo personaggio"), { target: { value: "Elena" } });
    fireEvent.click(screen.getByRole("button", { name: /^crea$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Elena" })).toBeInTheDocument();
    });
  });

  it("apre un personaggio e offusca le anteprime se privato", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/characters/c1")) {
          return jsonResponse({
            id: "c1", name: "Elena", description: null, tags: [], is_private: true, image_count: 1,
            main_image_id: "img1", notes: null,
            images: [{ id: "img1", character_id: "c1", role: "main", order_index: 0, source: "upload", width: null, height: null, created_at: "2026-01-01T00:00:00Z" }],
            created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
          });
        }
        if (url.endsWith("/characters")) {
          return jsonResponse([
            { id: "c1", name: "Elena", description: null, tags: [], is_private: true, image_count: 1, main_image_id: "img1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
          ]);
        }
        return jsonResponse({});
      }),
    );

    render(<CharactersPanel />);
    await waitFor(() => expect(screen.getByRole("button", { name: /apri/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /apri/i }));

    await waitFor(() => {
      const img = screen.getByRole("img") as HTMLImageElement;
      expect(img.className).toContain("characters-panel__thumb--blurred");
    });
  });
});
