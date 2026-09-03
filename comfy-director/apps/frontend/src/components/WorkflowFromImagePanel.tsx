import { useState } from "react";

import { bridgeClient, type WorkflowImportResponse } from "../api/bridgeClient";
import { useWorkflowStore } from "../store/workflowStore";

type Status = "idle" | "loading" | "done" | "error";

/**
 * WORKFLOW DA IMMAGINE (spec §8). Legge davvero i metadata ComfyUI incorporati nel
 * PNG caricato — se non ci sono, lo dice chiaramente (mai un workflow inventato).
 *
 * Bug corretto (audit di robustezza): prima, quando un workflow veniva trovato,
 * questo pannello mostrava solo un elenco testuale senza mai aprirlo sulla canvas
 * reale (Fase 3) — l'utente restava bloccato con "non vedo nulla". Ora, se il grafo è
 * ricostruibile (stessa logica di "Importa da file .json"), viene aperto
 * automaticamente sulla canvas a destra, esattamente come l'import da .json.
 */
export function WorkflowFromImagePanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<WorkflowImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const openWorkflow = useWorkflowStore((s) => s.openWorkflow);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const response = await bridgeClient.workflowFromImage(file);
      setResult(response);
      setStatus("done");
      if (response.workflow) {
        await openWorkflow(response.workflow.id);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section aria-label="Workflow da Immagine">
      <h2>Workflow da Immagine</h2>
      <p className="settings-panel__hint">
        Carica una PNG generata da ComfyUI: se contiene il workflow incorporato lo leggo davvero e, se ricostruibile,
        lo apro subito sulla canvas a destra — come "Importa da file .json".
      </p>

      <input
        type="file"
        accept="image/png"
        aria-label="Carica immagine"
        onChange={handleFileChange}
        disabled={status === "loading"}
      />
      {fileName && <p className="settings-panel__hint">File: {fileName}</p>}

      {status === "loading" && <p>Analisi in corso…</p>}
      {status === "error" && error && (
        <p role="alert" className="settings-panel__feedback--error">
          {error}
        </p>
      )}

      {status === "done" && result && !result.found && (
        <p role="status">{result.message}</p>
      )}

      {status === "done" && result && result.found && (
        <div>
          <p role="status">{result.message}</p>
          {result.workflow && (
            <p className="settings-panel__feedback">
              Aperto sulla canvas come "{result.workflow.name}" ({result.workflow.node_count} nodi,{" "}
              {result.workflow.edge_count} collegamenti).
            </p>
          )}
          <dl className="settings-panel__sync-report">
            <dt>Formato</dt>
            <dd>{result.source === "workflow" ? "UI (con layout)" : "API (senza layout)"}</dd>
            <dt>Nodi</dt>
            <dd>{result.node_count}</dd>
            <dt>Collegamenti</dt>
            <dd>{result.link_count}</dd>
            <dt>Verificato contro l'inventario</dt>
            <dd>{result.inventory_checked ? "sì" : "no (nessuna sincronizzazione fatta finora)"}</dd>
          </dl>

          {result.missing_node_types.length > 0 && (
            <p role="alert" className="settings-panel__feedback--error">
              Componenti non installati: {result.missing_node_types.join(", ")}
            </p>
          )}

          <ul className="models-panel__list">
            {result.nodes.map((n) => (
              <li key={n.id} className="models-panel__item">
                <span className="models-panel__name">{n.title || n.class_type}</span>
                <span className="models-panel__meta">
                  {n.class_type}
                  {n.present_in_inventory === true && " · installato"}
                  {n.present_in_inventory === false && " · NON installato"}
                  {n.present_in_inventory === null && " · non verificato"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
