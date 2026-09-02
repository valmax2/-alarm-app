import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGenerationStore } from "./generationStore";

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

function generation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "g1", workflow_id: "w1", workflow_version_id: "v1", comfy_prompt_id: "p1",
    status: "queued", seed: null, outputs: [], node_errors: null, duration_ms: null,
    error_message: null, current_node_id: null, progress_value: null, progress_max: null,
    created_at: "2026-01-01T00:00:00Z", started_at: null, finished_at: null,
    ...overrides,
  };
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  useGenerationStore.setState({ current: null, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useGenerationStore.setState({ current: null, error: null });
});

describe("generationStore", () => {
  it("generate() avvia la generazione e fa polling finché non è in uno stato terminale", async () => {
    let historyCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/workflows/w1/generate") && init?.method === "POST") {
          return jsonResponse(generation({ status: "queued" }));
        }
        if (url.endsWith("/generations/g1")) {
          historyCalls += 1;
          return jsonResponse(generation({ status: historyCalls === 1 ? "running" : "completed", outputs: [{ filename: "a.png", subfolder: "", type: "output" }] }));
        }
        return jsonResponse({});
      }),
    );

    await useGenerationStore.getState().generate("w1");
    expect(useGenerationStore.getState().current?.status).toBe("queued");

    await vi.advanceTimersByTimeAsync(1600);
    expect(useGenerationStore.getState().current?.status).toBe("running");

    await vi.advanceTimersByTimeAsync(1600);
    expect(useGenerationStore.getState().current?.status).toBe("completed");
    expect(useGenerationStore.getState().current?.outputs).toHaveLength(1);

    // stato terminale: nessun'altra chiamata di polling programmata
    const callsAtCompletion = historyCalls;
    await vi.advanceTimersByTimeAsync(5000);
    expect(historyCalls).toBe(callsAtCompletion);
  });

  it("abort() interrompe la generazione e ferma il polling", async () => {
    let getCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/workflows/w1/generate")) return jsonResponse(generation({ status: "running" }));
        if (url.endsWith("/generations/g1/abort")) return jsonResponse(generation({ status: "aborted" }));
        if (url.endsWith("/generations/g1")) {
          getCalls += 1;
          return jsonResponse(generation({ status: "running" }));
        }
        return jsonResponse({});
      }),
    );

    await useGenerationStore.getState().generate("w1");
    await useGenerationStore.getState().abort();
    expect(useGenerationStore.getState().current?.status).toBe("aborted");

    const callsAfterAbort = getCalls;
    await vi.advanceTimersByTimeAsync(5000);
    expect(getCalls).toBe(callsAfterAbort); // il polling non deve ripartire dopo l'abort
  });

  it("reset() pulisce lo stato e ferma un polling in corso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/workflows/w1/generate")) return jsonResponse(generation({ status: "queued" }));
        return jsonResponse(generation({ status: "queued" }));
      }),
    );

    await useGenerationStore.getState().generate("w1");
    useGenerationStore.getState().reset();
    expect(useGenerationStore.getState().current).toBeNull();

    // nessun aggiornamento tardivo deve riapparire dopo il reset
    await vi.advanceTimersByTimeAsync(5000);
    expect(useGenerationStore.getState().current).toBeNull();
  });

  it("generate() apre il canale WS live e aggiorna nodo/percentuale da un evento 'progress'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/workflows/w1/generate")) return jsonResponse(generation({ status: "running" }));
        return jsonResponse(generation({ status: "running" }));
      }),
    );

    await useGenerationStore.getState().generate("w1");
    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0].emit({ type: "progress", node_id: "3", progress_value: 4, progress_max: 20 });

    const current = useGenerationStore.getState().current;
    expect(current?.current_node_id).toBe("3");
    expect(current?.progress_value).toBe(4);
    expect(current?.progress_max).toBe(20);
  });

  it("un messaggio WS 'final_pending' forza subito un refresh REST (senza aspettare il prossimo polling)", async () => {
    let getCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/workflows/w1/generate")) return jsonResponse(generation({ status: "running" }));
        if (url.endsWith("/generations/g1")) {
          getCalls += 1;
          return jsonResponse(generation({ status: "completed", outputs: [{ filename: "a.png", subfolder: "", type: "output" }] }));
        }
        return jsonResponse({});
      }),
    );

    await useGenerationStore.getState().generate("w1");
    FakeWebSocket.instances[0].emit({ type: "final_pending" });
    await vi.advanceTimersByTimeAsync(0); // lascia risolvere la Promise di getGeneration() innescata dal messaggio
    expect(useGenerationStore.getState().current?.status).toBe("completed");
    expect(getCalls).toBeGreaterThan(0);
  });

  it("abort() chiude il canale WS live insieme al polling", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/workflows/w1/generate")) return jsonResponse(generation({ status: "running" }));
        if (url.endsWith("/generations/g1/abort")) return jsonResponse(generation({ status: "aborted" }));
        return jsonResponse(generation({ status: "running" }));
      }),
    );

    await useGenerationStore.getState().generate("w1");
    await useGenerationStore.getState().abort();
    expect(FakeWebSocket.instances[0].closed).toBe(true);
  });
});
