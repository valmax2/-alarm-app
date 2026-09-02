import { useCallback, useEffect, useState } from "react";

import { bridgeClient, BridgeUnreachableError, type ComfyStatusResponse } from "../api/bridgeClient";

type BridgeState =
  | { kind: "checking" }
  | { kind: "bridge-unreachable" }
  | { kind: "comfy-status"; comfy: ComfyStatusResponse };

const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * Interroga lo stato reale del Bridge e di ComfyUI. Tre stati distinti e mai confusi
 * (spec §3, §34): il Bridge stesso irraggiungibile è diverso da "Bridge online ma
 * ComfyUI spento".
 */
export function useBridgeStatus(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [state, setState] = useState<BridgeState>({ kind: "checking" });

  const refresh = useCallback(async () => {
    try {
      await bridgeClient.getHealth();
    } catch (error) {
      if (error instanceof BridgeUnreachableError) {
        setState({ kind: "bridge-unreachable" });
        return;
      }
      throw error;
    }

    try {
      const comfy = await bridgeClient.getComfyStatus();
      setState({ kind: "comfy-status", comfy });
    } catch {
      // Il Bridge ha risposto a /health ma non a /comfy/status: comportamento
      // inatteso, trattato comunque come "non affidabile" piuttosto che nascosto.
      setState({ kind: "bridge-unreachable" });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => window.clearInterval(id);
  }, [refresh, pollIntervalMs]);

  return { state, refresh };
}

export function BridgeStatus() {
  const { state } = useBridgeStatus();

  if (state.kind === "checking") {
    return (
      <span className="bridge-status bridge-status--checking" role="status">
        Verifica in corso…
      </span>
    );
  }

  if (state.kind === "bridge-unreachable") {
    return (
      <span className="bridge-status bridge-status--error" role="status">
        ⛔ Bridge non raggiungibile
      </span>
    );
  }

  const { comfy } = state;
  if (comfy.status === "online") {
    return (
      <span className="bridge-status bridge-status--online" role="status">
        🟢 ComfyUI online{comfy.version ? ` (v${comfy.version})` : ""}
      </span>
    );
  }

  return (
    <span className="bridge-status bridge-status--offline" role="status">
      🔴 ComfyUI offline{comfy.reason ? ` — ${comfy.reason}` : ""}
    </span>
  );
}
