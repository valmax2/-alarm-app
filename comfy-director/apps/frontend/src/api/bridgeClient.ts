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

export interface ImportedNodeOut {
  id: string;
  class_type: string;
  title: string | null;
  present_in_inventory: boolean | null;
}

export interface WorkflowImportResponse {
  found: boolean;
  source: "workflow" | "prompt" | null;
  node_count: number;
  link_count: number;
  nodes: ImportedNodeOut[];
  missing_node_types: string[];
  inventory_checked: boolean;
  message: string;
}

export interface WidgetSpec {
  name: string;
  kind: "required" | "optional";
  enum_values: string[] | null;
  type: string | null;
  default: unknown;
  min: number | null;
  max: number | null;
  step: number | null;
}

export interface OutputSpec {
  name: string;
  type: string;
}

export interface NodeSchemaOut {
  class_type: string;
  display_name: string;
  category: string;
  is_custom_node: boolean;
  input_summary: WidgetSpec[];
  output_summary: OutputSpec[];
}

export interface GraphNode {
  id: string;
  class_type: string;
  position: { x: number; y: number };
  params: Record<string, unknown>;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  source_handle: string;
  target: string;
  target_handle: string;
}

export interface WorkflowGraphData {
  nodes: GraphNode[];
  edges: GraphEdgeData[];
}

export interface ValidationIssueOut {
  severity: "error" | "warning";
  node_id: string | null;
  message: string;
}

export interface WorkflowSummaryOut {
  id: string;
  name: string;
  intent: string | null;
  family: string | null;
  source: string;
  node_count: number;
  edge_count: number;
  updated_at: string;
}

export interface WorkflowDetailOut {
  id: string;
  name: string;
  intent: string | null;
  family: string | null;
  source: string;
  version_number: number;
  graph: WorkflowGraphData;
  validation_issues: ValidationIssueOut[];
  updated_at: string;
}

export interface WorkflowImportJsonResponse {
  workflow: WorkflowSummaryOut;
  source: "prompt" | "workflow";
  unmapped_widget_node_types: string[];
}

export interface AppliedPromptTarget {
  role: "positive" | "negative";
  node_id: string;
  class_type: string;
  param_name: string;
}

export interface ApplyPromptResponse {
  workflow: WorkflowDetailOut;
  applied: AppliedPromptTarget[];
  warnings: string[];
}

export interface GenerationOutput {
  filename: string;
  subfolder: string;
  type: string;
}

export type GenerationStatus = "queued" | "running" | "completed" | "error" | "aborted";

export interface GenerationOut {
  id: string;
  workflow_id: string | null;
  workflow_version_id: string | null;
  comfy_prompt_id: string | null;
  status: GenerationStatus;
  seed: number | null;
  outputs: GenerationOutput[];
  node_errors: Record<string, unknown> | null;
  duration_ms: number | null;
  error_message: string | null;
  // Fase 6 v2: aggiornati dal relay WS live se mai connesso (vedi generationStore.ts) —
  // `null` finché nessun evento è arrivato, mai un valore inventato.
  current_node_id: string | null;
  progress_value: number | null;
  progress_max: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/** Messaggi ricevuti su `/generations/{id}/live` (Fase 6 v2, spec §18). */
export type GenerationLiveMessage =
  | { type: "error"; message: string }
  | { type: "final"; status: GenerationStatus }
  | { type: "final_pending" }
  | { type: "status" | "progress" | "executing" | "execution_error" | "execution_cached" | "unknown"; node_id: string | null; progress_value: number | null; progress_max: number | null };

export type AIProviderKind = "anthropic" | "openai" | "local";

export interface AIProviderOut {
  id: string;
  kind: AIProviderKind;
  label: string;
  base_url: string | null;
  default_model: string | null;
  enabled: boolean;
  has_api_key: boolean;
  created_at: string;
}

export interface StructuredPromptOut {
  subject: string;
  identity: string;
  hair: string;
  face: string;
  body_clothing: string;
  pose_action: string;
  environment: string;
  camera: string;
  light: string;
  style: string;
  details: string;
  final_prompt_en: string;
}

export interface ChatMessageOut {
  id: string;
  role: "user" | "assistant";
  text: string;
  provider_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ErrorLogOut {
  id: string;
  level: "warning" | "error" | "critical";
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

export interface DiagnosticsReportOut {
  generated_at: string;
  app_version: string;
  python_version: string;
  platform: string;
  recent_errors: ErrorLogOut[];
}

export interface PromptOut {
  id: string;
  generation_id: string | null;
  text_it: string | null;
  text_en: string;
  negative_text_en: string | null;
  translation_locked: boolean;
  created_at: string;
}

export interface PromptPresetOut {
  id: string;
  name: string;
  category: string | null;
  tags: string[];
  text_it: string | null;
  text_en: string;
  negative_text_en: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptCatalogOption {
  label_it: string;
  value_en: string;
}

export interface PromptCatalogOptionGroup {
  key: string;
  label_it: string;
  options: PromptCatalogOption[];
}

export interface PromptCatalogOut {
  body: Record<string, PromptCatalogOptionGroup[]>; // "female" | "male" -> gruppi
  face: PromptCatalogOptionGroup[];
  hair_categories: Record<string, PromptCatalogOption[]>;
  hair_colors: PromptCatalogOption[];
  clothing_states: PromptCatalogOption[];
  underwear_categories: Record<string, PromptCatalogOption[]>;
  actions: PromptCatalogOption[];
  poses: PromptCatalogOption[];
  environments: PromptCatalogOption[];
  camera: PromptCatalogOptionGroup[]; // framing | angle | lens
  lights: PromptCatalogOption[];
  negative_default: string;
}

export interface StructuredPromptRequest {
  gender: "female" | "male";
  age?: number | null;
  clothing_state?: string | null;
  underwear_item?: string | null;
  body?: Record<string, string>;
  face_mode?: "" | "create";
  face?: Record<string, string>;
  hair_mode?: "" | "keep" | "change";
  hair?: string | null;
  custom_hair?: string | null;
  hair_color?: string | null;
  custom_action?: string | null;
  action?: string | null;
  pose?: string | null;
  custom_scene?: string | null;
  environment?: string | null;
  custom_photo?: string | null;
  camera_framing?: string | null;
  camera_angle?: string | null;
  camera_lens?: string | null;
  light?: string | null;
  coherent_character_id?: string | null;
}

export interface CharacterImageOut {
  id: string;
  character_id: string;
  role: "main" | "reference";
  order_index: number;
  source: string;
  width: number | null;
  height: number | null;
  // Oscuramento per SINGOLA immagine, indipendente da `is_private` del personaggio
  // (che oscura tutte le immagini insieme).
  is_hidden: boolean;
  created_at: string;
}

export interface CharacterSummaryOut {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  is_private: boolean;
  image_count: number;
  main_image_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterDetailOut extends CharacterSummaryOut {
  notes: string | null;
  images: CharacterImageOut[];
}

export interface PromptFromImageResponse {
  provider_id: string;
  provider_kind: string;
  structured: StructuredPromptOut;
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
  if (response.status === 204) return undefined as T; // es. DELETE: nessun corpo da leggere
  return (await response.json()) as T;
}

/** Come `request`, ma per upload multipart (nessun `Content-Type` forzato: il
 * browser imposta da solo il boundary corretto per FormData). */
async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BRIDGE_BASE_URL}${path}`, { method: "POST", body: formData });
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
      // corpo non JSON: usa il testo grezzo
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
  getNodeSchema: (classType: string) =>
    request<NodeSchemaOut>(`/inventory/nodes/${encodeURIComponent(classType)}/schema`),

  listWorkflows: () => request<WorkflowSummaryOut[]>("/workflows"),
  getKnownFamilies: () => request<string[]>("/workflows/known-families"),
  createWorkflow: (name: string, family?: string | null) =>
    request<WorkflowSummaryOut>("/workflows", {
      method: "POST",
      body: JSON.stringify({ name, family: family || null }),
    }),
  importWorkflowJson: (name: string, rawJson: string) =>
    request<WorkflowImportJsonResponse>("/workflows/import-json", {
      method: "POST",
      body: JSON.stringify({ name, raw_json: rawJson }),
    }),
  getWorkflow: (id: string) => request<WorkflowDetailOut>(`/workflows/${encodeURIComponent(id)}`),
  saveWorkflow: (id: string, graph: WorkflowGraphData, note?: string) =>
    request<WorkflowDetailOut>(`/workflows/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ graph, note }),
    }),
  deleteWorkflow: (id: string) => request<void>(`/workflows/${encodeURIComponent(id)}`, { method: "DELETE" }),
  applyPromptToWorkflow: (id: string, textEn: string, negativeTextEn?: string) =>
    request<ApplyPromptResponse>(`/workflows/${encodeURIComponent(id)}/apply-prompt`, {
      method: "POST",
      body: JSON.stringify({ text_en: textEn, negative_text_en: negativeTextEn || null }),
    }),

  generate: (workflowId: string) =>
    request<GenerationOut>(`/workflows/${encodeURIComponent(workflowId)}/generate`, { method: "POST" }),
  getGeneration: (id: string) => request<GenerationOut>(`/generations/${encodeURIComponent(id)}`),
  abortGeneration: (id: string) => request<GenerationOut>(`/generations/${encodeURIComponent(id)}/abort`, { method: "POST" }),
  listGenerations: (workflowId: string) =>
    request<GenerationOut[]>(`/generations${buildQuery({ workflow_id: workflowId })}`),
  // URL del canale WebSocket di progresso live (Fase 6 v2) — non passa da `request<T>`,
  // aperto direttamente da generationStore.ts con `new WebSocket(...)`.
  generationLiveUrl: (id: string) =>
    `${BRIDGE_BASE_URL.replace(/^http/, "ws") || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`}/generations/${encodeURIComponent(id)}/live`,
  // Non passa da `request<T>` (JSON): è l'URL diretto per un <img src=...> — il browser
  // scarica i byte via il Bridge (proxy verso GET /view di ComfyUI, mai un contatto
  // diretto frontend→ComfyUI, vedi docs/module-boundaries.md).
  generationOutputUrl: (generationId: string, index: number) =>
    `${BRIDGE_BASE_URL}/generations/${encodeURIComponent(generationId)}/outputs/${index}/file`,

  workflowFromImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return requestMultipart<WorkflowImportResponse>("/workflow-import/from-image", form);
  },

  getAIProviders: () => request<AIProviderOut[]>("/ai-providers"),
  createAIProvider: (input: {
    kind: AIProviderKind;
    label: string;
    api_key?: string;
    base_url?: string;
    default_model?: string;
  }) => request<AIProviderOut>("/ai-providers", { method: "POST", body: JSON.stringify(input) }),
  deleteAIProvider: (id: string) =>
    request<void>(`/ai-providers/${encodeURIComponent(id)}`, { method: "DELETE" }),

  promptFromImage: (file: File, providerId: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("provider_id", providerId);
    return requestMultipart<PromptFromImageResponse>("/prompt-from-image/analyze", form);
  },

  listChatMessages: () => request<ChatMessageOut[]>("/chat/messages"),
  sendChatMessage: (text: string, providerId: string) =>
    request<ChatMessageOut[]>("/chat/messages", {
      method: "POST",
      body: JSON.stringify({ text, provider_id: providerId }),
    }),
  clearChatMessages: () => request<void>("/chat/messages", { method: "DELETE" }),

  listCharacters: () => request<CharacterSummaryOut[]>("/characters"),
  getCharacter: (id: string) => request<CharacterDetailOut>(`/characters/${encodeURIComponent(id)}`),
  createCharacter: (input: { name: string; description?: string; tags?: string[]; notes?: string; is_private?: boolean }) =>
    request<CharacterSummaryOut>("/characters", { method: "POST", body: JSON.stringify(input) }),
  updateCharacter: (
    id: string,
    input: Partial<{ name: string; description: string; tags: string[]; notes: string; is_private: boolean }>,
  ) =>
    request<CharacterSummaryOut>(`/characters/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteCharacter: (id: string) => request<void>(`/characters/${encodeURIComponent(id)}`, { method: "DELETE" }),
  uploadCharacterImage: (characterId: string, file: File, role: "main" | "reference" = "reference") => {
    const form = new FormData();
    form.append("file", file);
    form.append("role", role);
    return requestMultipart<CharacterImageOut>(`/characters/${encodeURIComponent(characterId)}/images`, form);
  },
  deleteCharacterImage: (characterId: string, imageId: string) =>
    request<void>(`/characters/${encodeURIComponent(characterId)}/images/${encodeURIComponent(imageId)}`, {
      method: "DELETE",
    }),
  // Oscuramento per singola immagine, indipendente dal toggle "Privato" del personaggio.
  updateCharacterImage: (characterId: string, imageId: string, input: { is_hidden: boolean }) =>
    request<CharacterImageOut>(`/characters/${encodeURIComponent(characterId)}/images/${encodeURIComponent(imageId)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  characterImageUrl: (characterId: string, imageId: string) =>
    `${BRIDGE_BASE_URL}/characters/${encodeURIComponent(characterId)}/images/${encodeURIComponent(imageId)}/file`,
  // Fase 7 v2: export/import Character Pack. L'URL di export è usato direttamente in
  // un <a href download> (come generationOutputUrl) — non passa da request<T>, è il
  // browser a scaricare i byte del ZIP che il Bridge produce.
  characterExportUrl: (characterId: string) => `${BRIDGE_BASE_URL}/characters/${encodeURIComponent(characterId)}/export`,
  importCharacterPack: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return requestMultipart<CharacterDetailOut>("/characters/import", form);
  },

  translatePrompt: (textIt: string, providerId: string) =>
    request<{ text_en: string }>("/prompts/translate", {
      method: "POST",
      body: JSON.stringify({ text_it: textIt, provider_id: providerId }),
    }),
  listPrompts: () => request<PromptOut[]>("/prompts"),
  createPrompt: (input: { text_it?: string | null; text_en: string; negative_text_en?: string | null; translation_locked?: boolean }) =>
    request<PromptOut>("/prompts", { method: "POST", body: JSON.stringify(input) }),
  updatePrompt: (
    id: string,
    input: Partial<{ text_it: string | null; text_en: string; negative_text_en: string | null; translation_locked: boolean }>,
  ) => request<PromptOut>(`/prompts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }),
  deletePrompt: (id: string) => request<void>(`/prompts/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listPromptPresets: (filter?: { category?: string; tag?: string; q?: string }) =>
    request<PromptPresetOut[]>(`/prompt-presets${buildQuery({ category: filter?.category, tag: filter?.tag, q: filter?.q })}`),
  listPromptPresetTags: () => request<string[]>("/prompt-presets/tags"),
  createPromptPreset: (input: {
    name: string; category?: string | null; tags?: string[]; text_it?: string | null; text_en: string; negative_text_en?: string | null;
  }) => request<PromptPresetOut>("/prompt-presets", { method: "POST", body: JSON.stringify(input) }),
  updatePromptPreset: (
    id: string,
    input: Partial<{ name: string; category: string | null; tags: string[]; text_it: string | null; text_en: string; negative_text_en: string | null }>,
  ) => request<PromptPresetOut>(`/prompt-presets/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }),
  deletePromptPreset: (id: string) => request<void>(`/prompt-presets/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Smart Prompt Compiler + Coerenza Personaggio (portato da PromptStudio).
  getPromptCatalog: () => request<PromptCatalogOut>("/prompt-engine/catalog"),
  composeStructuredPrompt: (input: StructuredPromptRequest) =>
    request<{ text_en: string }>("/prompt-engine/compose", { method: "POST", body: JSON.stringify(input) }),

  listErrors: (limit = 50) => request<ErrorLogOut[]>(`/diagnostics/errors${buildQuery({ limit })}`),
  getDiagnosticsReport: () => request<DiagnosticsReportOut>("/diagnostics/report"),
};
