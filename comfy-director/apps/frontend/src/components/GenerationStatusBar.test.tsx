import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useGenerationStore } from "../store/generationStore";
import { GenerationStatusBar } from "./GenerationStatusBar";

afterEach(() => {
  cleanup();
  useGenerationStore.setState({ current: null, error: null });
});

describe("GenerationStatusBar", () => {
  it("mostra un messaggio neutro quando nessuna generazione è mai stata avviata", () => {
    render(<GenerationStatusBar />);
    expect(screen.getByText(/Nessuna generazione avviata/)).toBeInTheDocument();
  });

  it("mostra lo stato reale e nessuna miniatura mentre è in coda", () => {
    useGenerationStore.setState({
      current: {
        id: "g1", workflow_id: "w1", workflow_version_id: "v1", comfy_prompt_id: "p1",
        status: "queued", seed: null, outputs: [], node_errors: null, duration_ms: null,
        error_message: null, current_node_id: null, progress_value: null, progress_max: null,
        created_at: "2026-01-01T00:00:00Z", started_at: null, finished_at: null,
      },
    });
    render(<GenerationStatusBar />);
    expect(screen.getByText(/In coda/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("mostra le miniature degli output quando la generazione è completata", () => {
    useGenerationStore.setState({
      current: {
        id: "g1", workflow_id: "w1", workflow_version_id: "v1", comfy_prompt_id: "p1",
        status: "completed", seed: null,
        outputs: [{ filename: "out.png", subfolder: "", type: "output" }],
        node_errors: null, duration_ms: 1200, error_message: null,
        current_node_id: null, progress_value: null, progress_max: null,
        created_at: "2026-01-01T00:00:00Z", started_at: "2026-01-01T00:00:00Z", finished_at: "2026-01-01T00:00:01Z",
      },
    });
    render(<GenerationStatusBar />);
    expect(screen.getByText(/Completata/)).toBeInTheDocument();
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("/generations/g1/outputs/0/file");
  });

  it("mostra il messaggio di errore quando la generazione fallisce", () => {
    useGenerationStore.setState({
      current: {
        id: "g1", workflow_id: "w1", workflow_version_id: "v1", comfy_prompt_id: "p1",
        status: "error", seed: null, outputs: [], node_errors: null, duration_ms: null,
        error_message: "ComfyUI ha segnalato un errore di esecuzione.",
        current_node_id: null, progress_value: null, progress_max: null,
        created_at: "2026-01-01T00:00:00Z", started_at: null, finished_at: null,
      },
    });
    render(<GenerationStatusBar />);
    expect(screen.getByText(/ComfyUI ha segnalato un errore di esecuzione\./)).toBeInTheDocument();
  });

  it("mostra nodo in esecuzione e percentuale reali quando il relay WS live ha aggiornato lo stato", () => {
    useGenerationStore.setState({
      current: {
        id: "g1", workflow_id: "w1", workflow_version_id: "v1", comfy_prompt_id: "p1",
        status: "running", seed: null, outputs: [], node_errors: null, duration_ms: null,
        error_message: null, current_node_id: "3", progress_value: 4, progress_max: 20,
        created_at: "2026-01-01T00:00:00Z", started_at: "2026-01-01T00:00:00Z", finished_at: null,
      },
    });
    render(<GenerationStatusBar />);
    expect(screen.getByText(/nodo 3/)).toBeInTheDocument();
    expect(screen.getByText("4/20")).toBeInTheDocument();
  });

  it("non mostra nodo/percentuale se il relay WS non è mai stato connesso (v1 degradata)", () => {
    useGenerationStore.setState({
      current: {
        id: "g1", workflow_id: "w1", workflow_version_id: "v1", comfy_prompt_id: "p1",
        status: "running", seed: null, outputs: [], node_errors: null, duration_ms: null,
        error_message: null, current_node_id: null, progress_value: null, progress_max: null,
        created_at: "2026-01-01T00:00:00Z", started_at: "2026-01-01T00:00:00Z", finished_at: null,
      },
    });
    render(<GenerationStatusBar />);
    expect(screen.queryByText(/^nodo /)).not.toBeInTheDocument();
  });
});
