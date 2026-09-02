import { Handle, Position, type NodeProps } from "@xyflow/react";

import { useGenerationStore } from "../../store/generationStore";
import { isWidgetInput, useWorkflowStore, type ComfyFlowNode } from "../../store/workflowStore";

/**
 * Nodo custom della canvas (spec §10-§11). Aspetto ispirato a ComfyUI: titolo, porte
 * di input/output reali (lette dallo schema sincronizzato — Fase 2), e un riepilogo
 * compatto dei widget (l'editing vero avviene nel pannello proprietà contestuale,
 * spec §11: "Nodo selezionato → proprietà reali di quel nodo").
 *
 * Fase 6 v2: evidenzia il nodo che ComfyUI sta eseguendo ORA, se il relay WS live è
 * connesso (`generationStore.ts`) — l'id nodo del payload compilato (`workflow/
 * compile.py`) è lo stesso id usato qui, nessuna mappatura necessaria. Se il WS non è
 * connesso `current_node_id` resta sempre `null`: nessuna evidenziazione finta.
 */
export function ComfyNode({ id, data, selected }: NodeProps<ComfyFlowNode>) {
  const schema = useWorkflowStore((state) => state.schemaCache[data.classType]);
  const isExecuting = useGenerationStore(
    (s) => s.current !== null && (s.current.status === "running" || s.current.status === "queued") && s.current.current_node_id === id,
  );

  const inputs = schema?.input_summary ?? [];
  const outputs = schema?.output_summary ?? [];
  const socketInputs = inputs.filter((i) => !isWidgetInput(i));
  const widgetInputs = inputs.filter(isWidgetInput);

  return (
    <div
      className={`comfy-node${selected ? " comfy-node--selected" : ""}${isExecuting ? " comfy-node--executing" : ""}`}
      data-node-id={id}
    >
      <div className="comfy-node__title">{data.displayName}</div>
      {!schema && <div className="comfy-node__unknown">schema non disponibile</div>}

      <div className="comfy-node__body">
        <div className="comfy-node__inputs">
          {socketInputs.map((input) => (
            <div key={input.name} className="comfy-node__port-row">
              <Handle
                type="target"
                position={Position.Left}
                id={input.name}
                className="comfy-node__handle"
                style={{ position: "relative", transform: "none", left: 0 }}
              />
              <span className="comfy-node__port-label">{input.name}</span>
            </div>
          ))}
          {widgetInputs.length > 0 && (
            <div className="comfy-node__widgets">
              {widgetInputs.map((w) => (
                <div key={w.name} className="comfy-node__widget-row">
                  <span>{w.name}</span>
                  <span className="comfy-node__widget-value">{String(data.params[w.name] ?? "")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="comfy-node__outputs">
          {outputs.map((output) => (
            <div key={output.name} className="comfy-node__port-row comfy-node__port-row--output">
              <span className="comfy-node__port-label">{output.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={output.name}
                className="comfy-node__handle"
                style={{ position: "relative", transform: "none", right: 0 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
