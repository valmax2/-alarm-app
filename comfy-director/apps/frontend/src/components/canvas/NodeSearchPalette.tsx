import { useState } from "react";

import { bridgeClient, type NodeOut } from "../../api/bridgeClient";
import { useWorkflowStore } from "../../store/workflowStore";

// Griglia di posizionamento per i nuovi nodi: ogni aggiunta occupa la cella
// successiva (righe di 4 colonne) così i nodi non si sovrappongono mai tra
// loro, a differenza di un semplice offset incrementale troppo piccolo
// rispetto alla larghezza minima del nodo (180px).
let nextDropIndex = 0;
const DROP_GRID_COLS = 4;
const DROP_COL_WIDTH = 240;
const DROP_ROW_HEIGHT = 180;

/**
 * Ricerca/aggiunta nodo (spec §10: "ricerca nodo"). Cerca tra i nodi REALMENTE
 * sincronizzati (GET /inventory/nodes) — mai un elenco statico.
 */
export function NodeSearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NodeOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const addNode = useWorkflowStore((s) => s.addNode);

  async function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length === 0) {
      setResults([]);
      return;
    }
    try {
      const nodes = await bridgeClient.getNodes({ q: value });
      setResults(nodes.slice(0, 25));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleAdd(classType: string) {
    const col = nextDropIndex % DROP_GRID_COLS;
    const row = Math.floor(nextDropIndex / DROP_GRID_COLS);
    nextDropIndex += 1;
    void addNode(classType, { x: 120 + col * DROP_COL_WIDTH, y: 120 + row * DROP_ROW_HEIGHT });
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        + Aggiungi nodo
      </button>
    );
  }

  return (
    <div className="node-search-palette">
      <input
        type="text"
        autoFocus
        placeholder="Cerca nodo installato…"
        value={query}
        onChange={(e) => void handleQueryChange(e.target.value)}
      />
      <button type="button" onClick={() => setOpen(false)}>
        ✕
      </button>
      {error && <p className="settings-panel__feedback--error">{error}</p>}
      {results.length > 0 && (
        <ul className="node-search-palette__results">
          {results.map((n) => (
            <li key={n.class_type}>
              <button type="button" onClick={() => handleAdd(n.class_type)}>
                {n.display_name} <span className="models-panel__meta">{n.class_type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && results.length === 0 && !error && <p className="settings-panel__hint">Nessun nodo trovato.</p>}
    </div>
  );
}
