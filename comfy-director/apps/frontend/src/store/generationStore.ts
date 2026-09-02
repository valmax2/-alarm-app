/**
 * Stato della generazione corrente (Fase 6, spec §18).
 *
 * Fase 6 v1: solo polling periodico su `GET /generations/{id}`. Fase 6 v2 aggiunge un
 * canale WebSocket (`/generations/{id}/live`) per il progresso live (nodo in
 * esecuzione, percentuale) — ma il polling REST resta attivo e resta l'UNICA fonte
 * per lo stato finale/output: se il WebSocket non si connette o si interrompe, la UI
 * degrada semplicemente a v1 (nessun progresso live, ma stato comunque corretto) — mai
 * bloccata, mai un valore inventato in assenza di eventi WS.
 */
import { create } from "zustand";

import { bridgeClient, type GenerationLiveMessage, type GenerationOut } from "../api/bridgeClient";

const POLL_INTERVAL_MS = 1500;

interface GenerationState {
  current: GenerationOut | null;
  error: string | null;

  generate: (workflowId: string) => Promise<void>;
  abort: () => Promise<void>;
  reset: () => void;
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let liveSocket: WebSocket | null = null;

function stopPolling() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function stopLiveSocket() {
  if (liveSocket !== null) {
    liveSocket.onmessage = null;
    liveSocket.onerror = null;
    liveSocket.onclose = null;
    liveSocket.close();
    liveSocket = null;
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
    stopLiveSocket();
    set({ error: null });
    try {
      const generation = await bridgeClient.generate(workflowId);
      set({ current: generation });
      if (!isTerminal(generation.status)) {
        schedulePoll(generation.id, set, get);
        openLiveSocket(generation.id, set, get);
      }
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
      stopLiveSocket();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  reset: () => {
    stopPolling();
    stopLiveSocket();
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
        if (!isTerminal(updated.status)) {
          schedulePoll(generationId, set, get);
        } else {
          stopLiveSocket();
        }
      } catch (err) {
        if (get().current?.id !== generationId) return;
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, POLL_INTERVAL_MS);
}

/** Fase 6 v2: apre il canale WS di progresso live. Puramente un'ottimizzazione di
 * reattività — nessun errore qui viene mai propagato come errore della generazione
 * (quello resta compito del polling REST, sempre attivo in parallelo). */
function openLiveSocket(
  generationId: string,
  set: (partial: Partial<GenerationState>) => void,
  get: () => GenerationState,
) {
  let socket: WebSocket;
  try {
    socket = new WebSocket(bridgeClient.generationLiveUrl(generationId));
  } catch {
    return; // browser/ambiente senza supporto WebSocket: si resta su solo polling
  }
  liveSocket = socket;

  socket.onmessage = (ev: MessageEvent<string>) => {
    if (get().current?.id !== generationId) return;
    let message: GenerationLiveMessage;
    try {
      message = JSON.parse(ev.data) as GenerationLiveMessage;
    } catch {
      return; // messaggio non riconosciuto: ignorato, mai un crash della UI
    }
    if (message.type === "final_pending" || message.type === "final") {
      // Lo stato/output definitivi restano autorevoli solo via REST: forziamo subito
      // un refresh invece di aspettare il prossimo giro di polling programmato.
      void bridgeClient.getGeneration(generationId).then((updated) => {
        if (get().current?.id !== generationId) return;
        set({ current: updated });
        if (isTerminal(updated.status)) stopLiveSocket();
      });
      return;
    }
    if (message.type === "error") return; // fallback silenzioso sul polling REST
    const current = get().current;
    if (!current) return;
    set({
      current: {
        ...current,
        current_node_id: message.node_id,
        progress_value: message.progress_value,
        progress_max: message.progress_max,
      },
    });
  };
  // onerror/onclose: nessuna azione — il polling REST resta comunque attivo e
  // corretto; non è un errore della generazione, solo una degradazione a v1.
}
