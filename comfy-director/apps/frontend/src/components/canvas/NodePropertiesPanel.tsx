import type { WidgetSpec } from "../../api/bridgeClient";
import { isWidgetInput, useWorkflowStore } from "../../store/workflowStore";

function WidgetEditor({
  input,
  value,
  onChange,
}: {
  input: WidgetSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `widget-${input.name}`;

  if (input.enum_values) {
    return (
      <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        {input.enum_values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }
  if (input.type === "BOOLEAN") {
    return <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (input.type === "INT" || input.type === "FLOAT") {
    return (
      <input
        id={id}
        type="number"
        value={typeof value === "number" ? value : ""}
        min={input.min ?? undefined}
        max={input.max ?? undefined}
        step={input.step ?? (input.type === "INT" ? 1 : 0.01)}
        onChange={(e) => onChange(input.type === "INT" ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
      />
    );
  }
  // STRING e fallback
  return <textarea id={id} rows={2} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}

/** Pannello proprietà contestuale (spec §11: "Nodo selezionato → proprietà reali di
 * quel nodo"). Widget generati dinamicamente dallo schema reale sincronizzato — mai
 * hardcoded (regola 2 della spec). */
export function NodePropertiesPanel() {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const schema = useWorkflowStore((s) => (node ? s.schemaCache[node.data.classType] : undefined));
  const edges = useWorkflowStore((s) => s.edges);
  const updateNodeParam = useWorkflowStore((s) => s.updateNodeParam);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const selectNode = useWorkflowStore((s) => s.selectNode);

  if (!selectedNodeId || !node) return null;

  const connectedInputs = new Set(edges.filter((e) => e.target === node.id).map((e) => e.targetHandle));

  return (
    <section aria-label="Proprietà nodo">
      <h2>{node.data.displayName}</h2>
      <p className="settings-panel__hint">{node.data.classType}</p>

      {!schema && (
        <p role="alert" className="settings-panel__feedback--error">
          Schema non disponibile: questo nodo non risulta nell'ultimo inventario
          sincronizzato.
        </p>
      )}

      {schema && (
        <>
          {schema.input_summary.filter(isWidgetInput).map((input) => (
            <div key={input.name} className="node-properties__field">
              <label htmlFor={`widget-${input.name}`}>{input.name}</label>
              <WidgetEditor
                input={input}
                value={node.data.params[input.name]}
                onChange={(value) => updateNodeParam(node.id, input.name, value)}
              />
            </div>
          ))}

          {schema.input_summary.filter((i) => !isWidgetInput(i)).length > 0 && (
            <>
              <h3>Ingressi collegati</h3>
              <ul className="models-panel__list">
                {schema.input_summary
                  .filter((i) => !isWidgetInput(i))
                  .map((input) => (
                    <li key={input.name} className="models-panel__item">
                      <span className="models-panel__name">{input.name}</span>
                      <span className="models-panel__meta">
                        {connectedInputs.has(input.name) ? "collegato" : "non collegato"}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => {
          removeNode(node.id);
          selectNode(null);
        }}
      >
        Elimina nodo
      </button>
    </section>
  );
}
