/**
 * Store del workflow — UNICA source of truth mentre l'utente edita sulla canvas
 * (spec §10: "Se cambia un collegamento sulla canvas, cambia il workflow. Se cambia
 * il workflow, cambia la canvas. Una sola source of truth."). La forma di
 * `nodes`/`edges` è quella nativa di React Flow; la conversione da/verso il formato
 * persistito dal Bridge (`GraphNode[]`/`GraphEdgeData[]`) avviene solo qui, ai bordi
 * (load/save).
 */
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";

import {
  bridgeClient,
  type GraphEdgeData,
  type GraphNode,
  type NodeSchemaOut,
  type ValidationIssueOut,
  type WidgetSpec,
} from "../api/bridgeClient";

export interface ComfyNodeData extends Record<string, unknown> {
  classType: string;
  displayName: string;
  params: Record<string, unknown>;
}

export type ComfyFlowNode = Node<ComfyNodeData, "comfyNode">;

/** Un input è un "widget" (editabile a valore) se è un enum o uno degli scalari noti;
 * tutti gli altri tipi (MODEL, CONDITIONING, LATENT, IMAGE, VAE, CLIP, ...) sono
 * "socket" — richiedono un collegamento, non un valore diretto (convenzione ComfyUI). */
const WIDGET_SCALAR_TYPES = new Set(["INT", "FLOAT", "STRING", "BOOLEAN"]);
export function isWidgetInput(entry: WidgetSpec): boolean {
  return entry.enum_values !== null || WIDGET_SCALAR_TYPES.has(entry.type ?? "");
}

function defaultParamsFor(schema: NodeSchemaOut): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const input of schema.input_summary) {
    if (!isWidgetInput(input)) continue;
    if (input.default !== null && input.default !== undefined) {
      params[input.name] = input.default;
    } else if (input.enum_values && input.enum_values.length > 0) {
      params[input.name] = input.enum_values[0];
    } else if (input.type === "BOOLEAN") {
      params[input.name] = false;
    } else if (input.type === "INT" || input.type === "FLOAT") {
      params[input.name] = 0;
    } else {
      params[input.name] = "";
    }
  }
  return params;
}

interface Snapshot {
  nodes: ComfyFlowNode[];
  edges: Edge[];
}

interface WorkflowState {
  workflowId: string | null;
  workflowName: string | null;
  versionNumber: number | null;
  nodes: ComfyFlowNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  validationIssues: ValidationIssueOut[];
  schemaCache: Record<string, NodeSchemaOut>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  past: Snapshot[];
  future: Snapshot[];

  newWorkflow: (name: string) => Promise<void>;
  openWorkflow: (id: string) => Promise<void>;
  closeWorkflow: () => void;
  save: () => Promise<void>;

  onNodesChange: (changes: NodeChange<ComfyFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  ensureSchema: (classType: string) => Promise<NodeSchemaOut | null>;
  addNode: (classType: string, position: { x: number; y: number }) => Promise<void>;
  removeNode: (nodeId: string) => void;
  updateNodeParam: (nodeId: string, paramName: string, value: unknown) => void;
  selectNode: (nodeId: string | null) => void;

  undo: () => void;
  redo: () => void;
}

function snapshotOf(state: WorkflowState): Snapshot {
  return { nodes: state.nodes, edges: state.edges };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowId: null,
  workflowName: null,
  versionNumber: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  validationIssues: [],
  schemaCache: {},
  loading: false,
  saving: false,
  error: null,
  past: [],
  future: [],

  newWorkflow: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const summary = await bridgeClient.createWorkflow(name);
      await get().openWorkflow(summary.id);
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  openWorkflow: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const detail = await bridgeClient.getWorkflow(id);
      const nodes: ComfyFlowNode[] = detail.graph.nodes.map((n) => ({
        id: n.id, type: "comfyNode", position: n.position,
        data: { classType: n.class_type, displayName: n.class_type, params: n.params },
      }));
      const edges: Edge[] = detail.graph.edges.map((e) => ({
        id: e.id, source: e.source, target: e.target, sourceHandle: e.source_handle, targetHandle: e.target_handle,
      }));
      set({
        workflowId: detail.id, workflowName: detail.name, versionNumber: detail.version_number,
        nodes, edges, selectedNodeId: null, validationIssues: detail.validation_issues,
        loading: false, past: [], future: [],
      });
      // Precarica gli schema dei nodi già presenti, per il pannello proprietà.
      const classTypes = Array.from(new Set(nodes.map((n) => n.data.classType)));
      await Promise.all(classTypes.map((ct) => get().ensureSchema(ct)));
      // Aggiorna il displayName ora che gli schema sono disponibili.
      set((state) => ({
        nodes: state.nodes.map((n) => {
          const schema = state.schemaCache[n.data.classType];
          return schema ? { ...n, data: { ...n.data, displayName: schema.display_name } } : n;
        }),
      }));
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  closeWorkflow: () => {
    set({
      workflowId: null, workflowName: null, versionNumber: null, nodes: [], edges: [],
      selectedNodeId: null, validationIssues: [], past: [], future: [], error: null,
    });
  },

  save: async () => {
    const state = get();
    if (!state.workflowId) return;
    set({ saving: true, error: null });
    try {
      const graph = {
        nodes: state.nodes.map<GraphNode>((n) => ({
          id: n.id, class_type: n.data.classType, position: n.position, params: n.data.params,
        })),
        edges: state.edges.map<GraphEdgeData>((e) => ({
          id: e.id, source: e.source, source_handle: e.sourceHandle ?? "", target: e.target, target_handle: e.targetHandle ?? "",
        })),
      };
      const detail = await bridgeClient.saveWorkflow(state.workflowId, graph);
      set({ versionNumber: detail.version_number, validationIssues: detail.validation_issues, saving: false });
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  onNodesChange: (changes) => {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
  },

  onEdgesChange: (changes) => {
    const state = get();
    set({ past: [...state.past, snapshotOf(state)], future: [] });
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
  },

  onConnect: (connection) => {
    const state = get();
    set({ past: [...state.past, snapshotOf(state)], future: [] });
    set((s) => ({ edges: addEdge(connection, s.edges) }));
  },

  ensureSchema: async (classType: string) => {
    const cached = get().schemaCache[classType];
    if (cached) return cached;
    try {
      const schema = await bridgeClient.getNodeSchema(classType);
      set((state) => ({ schemaCache: { ...state.schemaCache, [classType]: schema } }));
      return schema;
    } catch {
      return null; // nodo non nell'inventario sincronizzato: nessuno schema disponibile, gestito dal chiamante
    }
  },

  addNode: async (classType: string, position: { x: number; y: number }) => {
    const schema = await get().ensureSchema(classType);
    const state = get();
    set({ past: [...state.past, snapshotOf(state)], future: [] });
    const id = crypto.randomUUID();
    const newNode: ComfyFlowNode = {
      id, type: "comfyNode", position,
      data: {
        classType, displayName: schema?.display_name ?? classType,
        params: schema ? defaultParamsFor(schema) : {},
      },
    };
    set((s) => ({ nodes: [...s.nodes, newNode] }));
  },

  removeNode: (nodeId: string) => {
    const state = get();
    set({ past: [...state.past, snapshotOf(state)], future: [] });
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    }));
  },

  updateNodeParam: (nodeId: string, paramName: string, value: unknown) => {
    const state = get();
    set({ past: [...state.past, snapshotOf(state)], future: [] });
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, params: { ...n.data.params, [paramName]: value } } } : n,
      ),
    }));
  },

  selectNode: (nodeId: string | null) => set({ selectedNodeId: nodeId }),

  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    set({
      nodes: previous.nodes, edges: previous.edges,
      past: state.past.slice(0, -1), future: [snapshotOf(state), ...state.future],
    });
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({
      nodes: next.nodes, edges: next.edges,
      past: [...state.past, snapshotOf(state)], future: state.future.slice(1),
    });
  },
}));
