/**
 * Client HTTP verso il Bridge locale.
 *
 * In sviluppo (`npm run dev`, Vite su :5173) il Bridge gira come processo separato
 * (default `http://127.0.0.1:8787`, sovrascrivibile con `VITE_BRIDGE_URL`). In
 * produzione il Bridge serve anche i file statici del frontend dallo stesso
 * origin, quindi le chiamate relative funzionano senza configurazione.
 */

const BRIDGE_BASE_URL: string =
  (import.meta.env.VITE_BRIDGE_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

export interface HealthResponse {
  status: "ok";
  version: string;
  time: string;
}

export interface ComfyStatusResponse {
  status: "online" | "offline";
  reason: string | null;
  base_url: string;
  version: string | null;
  os: string | null;
  python_version: string | null;
  pytorch_version: string | null;
  checked_at: string;
}

export interface SettingsResponse {
  comfy_base_url: string;
}

/** Errore sollevato quando il Bridge stesso non risponde (processo spento/URL errato) —
 * distinto da un `ComfyStatusResponse.status === "offline"`, che invece significa "il
 * Bridge risponde ma ComfyUI no". */
export class BridgeUnreachableError extends Error {
  constructor(cause: unknown) {
    super("Bridge non raggiungibile");
    this.cause = cause;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BRIDGE_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (error) {
    throw new BridgeUnreachableError(error);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bridge ha risposto ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

export const bridgeClient = {
  getHealth: () => request<HealthResponse>("/health"),
  getComfyStatus: () => request<ComfyStatusResponse>("/comfy/status"),
  getSettings: () => request<SettingsResponse>("/settings"),
  updateSettings: (comfyBaseUrl: string) =>
    request<SettingsResponse>("/settings", {
      method: "PUT",
      body: JSON.stringify({ comfy_base_url: comfyBaseUrl }),
    }),
};
