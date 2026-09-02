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
  comfy_root_path: string | null;
}

export interface SyncResponse {
  comfy_status: "online" | "offline";
  comfy_version: string | null;
  node_count: number;
  custom_node_count: number;
  model_count: number;
  model_counts_by_type: Record<string, number>;
  filesystem_scan_used: boolean;
  synced_at: string;
}

export type Compatibility = "compatible" | "incompatible" | "unknown" | "warning";

export interface ModelOut {
  id: string;
  name: string;
  path: string;
  model_type: string;
  extension: string;
  size_bytes: number | null;
  family: string | null;
  detection_confidence: number;
  detection_source: string;
  last_seen: string;
  compatibility: Compatibility | null;
  compatibility_reason: string | null;
}

export interface NodeOut {
  class_type: string;
  display_name: string;
  category: string;
  is_custom_node: boolean;
  last_seen: string;
}

export interface ModelsQuery {
  [key: string]: string | number | boolean | undefined;
  model_type?: string;
  family?: string;
  include_incompatible?: boolean;
  q?: string;
}

export interface NodesQuery {
  [key: string]: string | number | boolean | undefined;
  is_custom_node?: boolean;
  q?: string;
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

/** Errore applicativo con il messaggio reale restituito dal Bridge (es. "ComfyUI non
 * raggiungibile su http://..."), non un generico "Bridge ha risposto 503". */
export class BridgeRequestError extends Error {
  constructor(
    public status: number,
    detail: string,
  ) {
    super(detail);
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
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
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      // corpo non JSON (es. 500 "Internal Server Error" in testo semplice): usa il testo grezzo
    }
    throw new BridgeRequestError(response.status, detail || `Errore ${response.status}`);
  }
  return (await response.json()) as T;
}

export const bridgeClient = {
  getHealth: () => request<HealthResponse>("/health"),
  getComfyStatus: () => request<ComfyStatusResponse>("/comfy/status"),
  getSettings: () => request<SettingsResponse>("/settings"),
  updateSettings: (comfyBaseUrl: string, comfyRootPath: string | null) =>
    request<SettingsResponse>("/settings", {
      method: "PUT",
      body: JSON.stringify({ comfy_base_url: comfyBaseUrl, comfy_root_path: comfyRootPath || null }),
    }),
  syncComfy: () => request<SyncResponse>("/comfy/sync", { method: "POST" }),
  getModels: (query: ModelsQuery = {}) => request<ModelOut[]>(`/inventory/models${buildQuery(query)}`),
  getNodes: (query: NodesQuery = {}) => request<NodeOut[]>(`/inventory/nodes${buildQuery(query)}`),
};
