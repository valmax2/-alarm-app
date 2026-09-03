import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StructuredPromptBuilder } from "./StructuredPromptBuilder";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

const CATALOG = {
  body: {
    female: [{ key: "build", label_it: "Corporatura", options: [{ label_it: "Atletica", value_en: "athletic body" }] }],
    male: [],
  },
  face: [{ key: "eyes", label_it: "Occhi", options: [{ label_it: "Grandi", value_en: "large eyes" }] }],
  hair_categories: { Corti: [{ label_it: "Pixie", value_en: "pixie cut" }] },
  hair_colors: [{ label_it: "Rosso", value_en: "red hair" }],
  clothing_states: [{ label_it: "Vestita", value_en: "fully clothed" }],
  underwear_categories: { Reggiseni: [{ label_it: "Push-up", value_en: "push-up bra" }] },
  actions: [{ label_it: "In piedi", value_en: "standing" }],
  poses: [{ label_it: "Frontale", value_en: "front-facing pose" }],
  environments: [{ label_it: "Spiaggia", value_en: "beach" }],
  camera: [
    { key: "framing", label_it: "Taglio", options: [{ label_it: "Primo piano", value_en: "close-up shot" }] },
    { key: "angle", label_it: "Angolo", options: [{ label_it: "Frontale", value_en: "camera directly in front of the subject" }] },
    { key: "lens", label_it: "Lens", options: [{ label_it: "50 mm", value_en: "50mm natural lens" }] },
  ],
  lights: [{ label_it: "Cinematografica", value_en: "cinematic lighting" }],
  negative_default: "low quality",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StructuredPromptBuilder", () => {
  it("resta chiuso finché non lo si espande, senza fare crashare la pagina", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/prompt-engine/catalog")) return jsonResponse(CATALOG);
        if (url.endsWith("/characters")) return jsonResponse([]);
        return jsonResponse({});
      }),
    );
    render(<StructuredPromptBuilder onComposed={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/Costruzione guidata/)).toBeInTheDocument());
    expect(screen.queryByLabelText("Genere")).not.toBeInTheDocument();
  });

  it("espanso mostra i menu reali dal catalogo e compone un prompt reale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/prompt-engine/catalog")) return jsonResponse(CATALOG);
        if (url.endsWith("/characters")) return jsonResponse([{ id: "c1", name: "Aria", description: null, tags: [], is_private: false, image_count: 0, main_image_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }]);
        if (url.endsWith("/prompt-engine/compose") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { gender: string; body: Record<string, string> };
          expect(body.gender).toBe("female");
          expect(body.body.build).toBe("athletic body");
          return jsonResponse({ text_en: "SINGLE SUBJECT ONLY, athletic body" });
        }
        return jsonResponse({});
      }),
    );

    const onComposed = vi.fn();
    render(<StructuredPromptBuilder onComposed={onComposed} />);
    await waitFor(() => expect(screen.getByText(/Costruzione guidata/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Costruzione guidata/));

    await waitFor(() => expect(screen.getByLabelText("Genere")).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Aria" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Corpo" }));
    fireEvent.click(screen.getByRole("button", { name: "Atletica" }));
    fireEvent.click(screen.getByRole("button", { name: /componi prompt/i }));

    await waitFor(() => {
      expect(onComposed).toHaveBeenCalledWith("SINGLE SUBJECT ONLY, athletic body");
    });
  });

  it("selezionando un personaggio coerente nasconde i controlli del viso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/prompt-engine/catalog")) return jsonResponse(CATALOG);
        if (url.endsWith("/characters")) return jsonResponse([{ id: "c1", name: "Aria", description: null, tags: [], is_private: false, image_count: 0, main_image_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }]);
        return jsonResponse({});
      }),
    );

    render(<StructuredPromptBuilder onComposed={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/Costruzione guidata/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Costruzione guidata/));
    await waitFor(() => expect(screen.getByLabelText("Genere")).toBeInTheDocument());

    expect(screen.getByText("Descrivi i tratti del viso")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Usa un personaggio della libreria/), { target: { value: "c1" } });

    await waitFor(() => {
      expect(screen.queryByText("Descrivi i tratti del viso")).not.toBeInTheDocument();
    });
  });

  it("mostra l'errore reale se la composizione fallisce", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/prompt-engine/catalog")) return jsonResponse(CATALOG);
        if (url.endsWith("/characters")) return jsonResponse([]);
        if (url.endsWith("/prompt-engine/compose") && init?.method === "POST") {
          return jsonResponse({ detail: "Personaggio coerente non trovato" }, 404);
        }
        return jsonResponse({});
      }),
    );

    render(<StructuredPromptBuilder onComposed={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/Costruzione guidata/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Costruzione guidata/));
    await waitFor(() => expect(screen.getByLabelText("Genere")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /componi prompt/i }));

    await waitFor(() => {
      expect(screen.getByText(/Personaggio coerente non trovato/)).toBeInTheDocument();
    });
  });

  it("scegliere stile e colore dal selettore con anteprime li include nella richiesta di composizione", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/prompt-engine/catalog")) return jsonResponse(CATALOG);
        if (url.endsWith("/characters")) return jsonResponse([]);
        if (url.endsWith("/prompt-engine/compose") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { hair: string; hair_color: string };
          expect(body.hair).toBe("pixie cut");
          expect(body.hair_color).toBe("red hair");
          return jsonResponse({ text_en: "..." });
        }
        return jsonResponse({});
      }),
    );

    render(<StructuredPromptBuilder onComposed={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/Costruzione guidata/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Costruzione guidata/));
    await waitFor(() => expect(screen.getByLabelText("Genere")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Modalità"), { target: { value: "change" } });
    fireEvent.click(await screen.findByTitle("Pixie"));
    fireEvent.click(screen.getByTitle("Rosso"));
    fireEvent.click(screen.getByRole("button", { name: /componi prompt/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });
});
