import "@xyflow/react/dist/style.css";

import { Background, Controls, MiniMap, Panel, ReactFlow, type NodeMouseHandler } from "@xyflow/react";

import { useWorkflowStore } from "../../store/workflowStore";
import { ComfyNode } from "./ComfyNode";
import { NodeSearchPalette } from "./NodeSearchPalette";

const nodeTypes = { comfyNode: ComfyNode };

/**
 * Canvas reale del workflow (Fase 3, spec §10). Il grafo mostrato È il modello
 * interno (store Zustand) — cambiare un nodo/arco qui aggiorna il modello, e
 * viceversa: nessuna copia separata.
 */
export function WorkflowCanvas() {
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const save = useWorkflowStore((s) => s.save);
  const saving = useWorkflowStore((s) => s.saving);
  const canUndo = useWorkflowStore((s) => s.past.length > 0);
  const canRedo = useWorkflowStore((s) => s.future.length > 0);

  const handleNodeClick: NodeMouseHandler = (_event, node) => selectNode(node.id);
  const handlePaneClick = () => selectNode(null);

  if (!workflowId) {
    return (
      <div className="app-shell__canvas-empty">
        <p>Nessun workflow aperto.</p>
        <p className="app-shell__canvas-placeholder-note">
          Vai su "Workflow" nella barra laterale per crearne uno nuovo o aprirne uno
          esistente.
        </p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      deleteKeyCode={["Backspace", "Delete"]}
      minZoom={0.1}
    >
      <Background gap={16} />
      <Controls />
      <MiniMap pannable zoomable />
      <Panel position="top-left" className="canvas-toolbar">
        <NodeSearchPalette />
        <button type="button" onClick={undo} disabled={!canUndo} title="Annulla">
          ↶ Annulla
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Ripeti">
          ↷ Ripeti
        </button>
        <button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </Panel>
    </ReactFlow>
  );
}
