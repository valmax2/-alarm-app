import { useCallback, useEffect, useState } from "react";

import { bridgeClient, type NodeOut } from "../api/bridgeClient";

/**
 * Pannello Nodi (Fase 2). Reale: legge da /inventory/nodes, popolato dall'ultimo
 * /object_info letto realmente da ComfyUI in sincronizzazione — nessun nodo inventato.
 */
export function NodesPanel() {
  const [nodes, setNodes] = useState<NodeOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);

  const refresh = useCallback(() => {
    bridgeClient
      .getNodes({ q: query || undefined, is_custom_node: onlyCustom ? true : undefined })
      .then(setNodes)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [query, onlyCustom]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <section aria-label="Nodi">
        <h2>Nodi</h2>
        <p role="alert">{error}</p>
      </section>
    );
  }

  return (
    <section aria-label="Nodi">
      <h2>Nodi</h2>
      <div className="nodes-panel__filters">
        <label htmlFor="nodes-search">Cerca</label>
        <input id="nodes-search" type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="models-panel__checkbox">
          <input type="checkbox" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} />
          Solo custom node
        </label>
      </div>

      {nodes === null && <p>Caricamento…</p>}
      {nodes !== null && nodes.length === 0 && (
        <p>
          Nessun nodo in inventario. Vai su "Bridge ComfyUI" e premi "Sincronizza
          ComfyUI" (richiede ComfyUI acceso).
        </p>
      )}
      {nodes !== null && nodes.length > 0 && (
        <ul className="nodes-panel__list">
          {nodes.map((n) => (
            <li key={n.class_type} className="nodes-panel__item">
              <span className="nodes-panel__name">{n.display_name}</span>
              <span className="nodes-panel__meta">
                {n.class_type} · {n.category || "senza categoria"}
                {n.is_custom_node ? " · custom node" : " · core"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
