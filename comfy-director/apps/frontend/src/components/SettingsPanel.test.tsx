import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "./SettingsPanel";

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPanel", () => {
  it("carica l'URL corrente e salva un nuovo valore chiamando PUT /settings", async () => {
    let storedUrl = "http://127.0.0.1:8188";
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(init.body as string) as { comfy_base_url: string };
        storedUrl = body.comfy_base_url;
        return jsonResponse({ comfy_base_url: storedUrl });
      }
      return jsonResponse({ comfy_base_url: storedUrl });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPanel />);

    const input = await screen.findByLabelText<HTMLInputElement>("URL ComfyUI");
    await waitFor(() => expect(input.value).toBe("http://127.0.0.1:8188"));

    fireEvent.change(input, { target: { value: "http://192.168.1.50:8188" } });
    fireEvent.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => {
      expect(screen.getByText("Impostazioni salvate.")).toBeInTheDocument();
    });
    expect(storedUrl).toBe("http://192.168.1.50:8188");
  });
});
