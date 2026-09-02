import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "./ChatPanel";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PROVIDER = { id: "p1", kind: "anthropic", label: "Claude", base_url: null, default_model: null, enabled: true, has_api_key: true, created_at: "2026-01-01T00:00:00Z" };

describe("ChatPanel", () => {
  it("mostra i messaggi reali e invia un nuovo messaggio al provider selezionato", async () => {
    let messages: Array<{ id: string; role: string; text: string; provider_id: string | null; error_message: null; created_at: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/ai-providers")) return jsonResponse([PROVIDER]);
        if (url.endsWith("/chat/messages") && init?.method === "POST") {
          const body = JSON.parse(init.body as string) as { text: string; provider_id: string };
          const userMsg = { id: "u1", role: "user", text: body.text, provider_id: null, error_message: null, created_at: "2026-01-01T00:00:01Z" };
          const assistantMsg = { id: "a1", role: "assistant", text: "Risposta reale", provider_id: body.provider_id, error_message: null, created_at: "2026-01-01T00:00:02Z" };
          messages = [...messages, userMsg, assistantMsg];
          return jsonResponse([userMsg, assistantMsg]);
        }
        if (url.endsWith("/chat/messages")) return jsonResponse(messages);
        return jsonResponse({});
      }),
    );

    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByText(/Nessun messaggio ancora/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Messaggio"), { target: { value: "Ciao!" } });
    fireEvent.click(screen.getByRole("button", { name: /invia/i }));

    await waitFor(() => {
      expect(screen.getByText("Ciao!")).toBeInTheDocument();
      expect(screen.getByText("Risposta reale")).toBeInTheDocument();
    });
  });

  it("mostra l'errore reale se la chiamata al provider fallisce, senza inventare una risposta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/ai-providers")) return jsonResponse([PROVIDER]);
        if (url.endsWith("/chat/messages") && init?.method === "POST") {
          return jsonResponse({ detail: "Il provider ha risposto 401" }, 502);
        }
        if (url.endsWith("/chat/messages")) return jsonResponse([]);
        return jsonResponse({});
      }),
    );

    render(<ChatPanel />);
    await waitFor(() => expect(screen.getByLabelText("Provider")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Messaggio"), { target: { value: "Ciao!" } });
    fireEvent.click(screen.getByRole("button", { name: /invia/i }));

    await waitFor(() => {
      expect(screen.getByText(/Il provider ha risposto 401/)).toBeInTheDocument();
    });
  });

  it("dichiara esplicitamente che l'assistente non modifica ancora il workflow", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse([])));
    render(<ChatPanel />);
    expect(screen.getByText(/Non può ancora leggere o modificare il tuo workflow/)).toBeInTheDocument();
  });
});
