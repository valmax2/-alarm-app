import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromptEnginePanel } from "./PromptEnginePanel";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PROVIDER = { id: "p1", kind: "anthropic", label: "Claude", base_url: null, default_model: null, enabled: true, has_api_key: true, created_at: "2026-01-01T00:00:00Z" };

describe("PromptEnginePanel", () => {
  it("traduce un prompt reale e lo salva nella cronologia", async () => {
    let history: Array<{ id: string; generation_id: null; text_it: string | null; text_en: string; negative_text_en: string | null; translation_locked: boolean; created_at: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/ai-providers")) return jsonResponse([PROVIDER]);
        if (url.endsWith("/prompts/translate")) {
          const body = JSON.parse(init!.body as string) as { text_it: string };
          expect(body.text_it).toBe("un gatto rosso");
          return jsonResponse({ text_en: "a red cat" });
        }
        if (url.endsWith("/prompts") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { text_it: string; text_en: string };
          const created = {
            id: "pr1", generation_id: null, text_it: body.text_it, text_en: body.text_en,
            negative_text_en: null, translation_locked: false, created_at: "2026-01-01T00:00:00Z",
          };
          history = [...history, created];
          return jsonResponse(created);
        }
        if (url.endsWith("/prompts")) return jsonResponse(history);
        if (url.includes("/prompt-presets")) return jsonResponse([]);
        return jsonResponse({});
      }),
    );

    render(<PromptEnginePanel />);
    await waitFor(() => expect(screen.getByText(/Nessun prompt ancora salvato/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Prompt (italiano)"), { target: { value: "un gatto rosso" } });
    fireEvent.click(screen.getByRole("button", { name: /traduci in inglese/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Prompt (inglese) — editabile")).toHaveValue("a red cat");
    });

    fireEvent.click(screen.getByRole("button", { name: /salva nella cronologia/i }));

    await waitFor(() => {
      expect(screen.getByText("a red cat")).toBeInTheDocument();
    });
  });

  it("non traduce se il blocco traduzione è attivo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/ai-providers")) return jsonResponse([PROVIDER]);
        if (url.endsWith("/prompts")) return jsonResponse([]);
        if (url.includes("/prompt-presets")) return jsonResponse([]);
        return jsonResponse({});
      }),
    );

    render(<PromptEnginePanel />);
    await waitFor(() => expect(screen.getByLabelText("Provider per la traduzione")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Prompt (italiano)"), { target: { value: "ciao" } });
    fireEvent.click(screen.getByLabelText(/blocca traduzione/i));

    expect(screen.getByRole("button", { name: /traduci in inglese/i })).toBeDisabled();
  });

  it("mostra l'errore reale se la traduzione fallisce", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/ai-providers")) return jsonResponse([PROVIDER]);
        if (url.endsWith("/prompts/translate")) return jsonResponse({ detail: "Il provider ha risposto 401" }, 502);
        if (url.endsWith("/prompts")) return jsonResponse([]);
        if (url.includes("/prompt-presets")) return jsonResponse([]);
        return jsonResponse({});
      }),
    );

    render(<PromptEnginePanel />);
    await waitFor(() => expect(screen.getByLabelText("Provider per la traduzione")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Prompt (italiano)"), { target: { value: "ciao" } });
    fireEvent.click(screen.getByRole("button", { name: /traduci in inglese/i }));

    await waitFor(() => {
      expect(screen.getByText(/Il provider ha risposto 401/)).toBeInTheDocument();
    });
  });

  it("salva il prompt corrente come preset reale, con nome/categoria/tag", async () => {
    let presets: Array<{ id: string; name: string; category: string | null; tags: string[]; text_it: string | null; text_en: string; negative_text_en: string | null; created_at: string; updated_at: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/ai-providers")) return jsonResponse([PROVIDER]);
        if (url.endsWith("/prompts")) return jsonResponse([]);
        if (url.endsWith("/prompt-presets/tags")) return jsonResponse([]);
        if (url.endsWith("/prompt-presets") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { name: string; category: string | null; tags: string[]; text_en: string };
          expect(body.name).toBe("Ritratto fantasy");
          expect(body.category).toBe("personaggi");
          expect(body.tags).toEqual(["fantasy", "ritratto"]);
          const created = {
            id: "preset1", name: body.name, category: body.category, tags: body.tags,
            text_it: null, text_en: body.text_en, negative_text_en: null,
            created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
          };
          presets = [...presets, created];
          return jsonResponse(created);
        }
        if (url.includes("/prompt-presets")) return jsonResponse(presets);
        return jsonResponse({});
      }),
    );

    render(<PromptEnginePanel />);
    await waitFor(() => expect(screen.getByLabelText("Provider per la traduzione")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Prompt (inglese) — editabile"), { target: { value: "a fantasy portrait" } });
    fireEvent.change(screen.getByLabelText("Nome del preset"), { target: { value: "Ritratto fantasy" } });
    fireEvent.change(screen.getByLabelText("Categoria (opzionale)"), { target: { value: "personaggi" } });
    fireEvent.change(screen.getByLabelText(/Tag/), { target: { value: "fantasy, ritratto" } });
    fireEvent.click(screen.getByRole("button", { name: /salva come preset/i }));

    await waitFor(() => {
      expect(screen.getByText("Ritratto fantasy")).toBeInTheDocument();
    });
  });

  it("carica un preset esistente negli editor e blocca la traduzione", async () => {
    const preset = {
      id: "preset1", name: "Ritratto fantasy", category: "personaggi", tags: ["fantasy"],
      text_it: "un ritratto fantasy", text_en: "a fantasy portrait", negative_text_en: "blurry",
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/ai-providers")) return jsonResponse([PROVIDER]);
        if (url.endsWith("/prompts")) return jsonResponse([]);
        if (url.endsWith("/prompt-presets/tags")) return jsonResponse(["fantasy"]);
        if (url.includes("/prompt-presets")) return jsonResponse([preset]);
        return jsonResponse({});
      }),
    );

    render(<PromptEnginePanel />);
    await waitFor(() => expect(screen.getByText("Ritratto fantasy")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^usa$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Prompt (inglese) — editabile")).toHaveValue("a fantasy portrait");
      expect(screen.getByLabelText("Prompt (italiano)")).toHaveValue("un ritratto fantasy");
      expect(screen.getByLabelText(/blocca traduzione/i)).toBeChecked();
    });
  });
});
