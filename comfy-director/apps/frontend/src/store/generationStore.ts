/**
 * Stato della generazione corrente (Fase 6, spec §18). Nessuna relay WebSocket in
 * questa consegna (dichiarato in bridge/comfy_client/client.py e
 * IMPLEMENTATION_PLAN.md): lo stato viene aggiornato con un polling periodico su
 * `GET /generations/{id}` finché non raggiunge uno stato terminale — mai una barra di
 * progresso o una percentuale finta nel frattempo, solo "in coda"/"in esecuzione".
 */
import { create } from "zustand";

import { bridgeClient, type GenerationOut } from "../api/bridgeClient";

const POLL_INTERVAL_MS = 1500;

interface GenerationState {
  current: GenerationOut | null;
  error: string | null;

  generate: (workflowId: string) => Promise<void>;
  abort: () => Promise<void>;
  reset: () => void;
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;

function stopPolling() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function isTerminal(status: GenerationOut["status"]): boolean {
  return status === "completed" || status === "error" || status === "aborted";
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  current: null,
  error: null,

  generate: async (workflowId: string) => {
    stopPolling();
    set({ error: null });
    try {
      const generation = await bridgeClient.generate(workflowId);
      set({ current: generation });
      if (!isTerminal(generation.status)) schedulePoll(generation.id, set, get);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  abort: async () => {
    const generation = get().current;
    if (!generation) return;
    try {
      const updated = await bridgeClient.abortGeneration(generation.id);
      set({ current: updated });
      stopPolling();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  reset: () => {
    stopPolling();
    set({ current: null, error: null });
  },
}));

function schedulePoll(
  generationId: string,
  set: (partial: Partial<GenerationState>) => void,
  get: () => GenerationState,
) {
  pollTimer = setTimeout(() => {
    void (async () => {
      // Se nel frattempo l'utente ha avviato/chiuso un'altra generazione, questo giro
      // di polling è obsoleto: non sovrascrivere lo stato corrente.
      if (get().current?.id !== generationId) return;
      try {
        const updated = await bridgeClient.getGeneration(generationId);
        if (get().current?.id !== generationId) return;
        set({ current: updated });
        if (!isTerminal(updated.status)) schedulePoll(generationId, set, get);
      } catch (err) {
        if (get().current?.id !== generationId) return;
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, POLL_INTERVAL_MS);
}
