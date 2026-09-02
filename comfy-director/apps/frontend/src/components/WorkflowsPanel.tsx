import { useEffect, useState } from "react";

import { bridgeClient, type WorkflowSummaryOut } from "../api/bridgeClient";
import { useWorkflowStore } from "../store/workflowStore";

/** Libreria workflow minimale (Fase 3): crea/apri/elimina. Duplica/rinomina/tag/
 * ricerca restano per la Fase 5 (Libreria Workflow completa, spec §7). */
export function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<WorkflowSummaryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const currentWorkflowId = useWorkflowStore((s) => s.workflowId);
  const validationIssues = useWorkflowStore((s) => s.validationIssues);
  const storeLoading = useWorkflowStore((s) => s.loading);
  const storeError = useWorkflowStore((s) => s.error);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const openWorkflow = useWorkflowStore((s) => s.openWorkflow);
  const closeWorkflow = useWorkflowStore((s) => s.closeWorkflow);

  function refresh() {
    bridgeClient
      .listWorkflows()
      .then((list) => {
        setWorkflows(list);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(refresh, [currentWorkflowId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    await newWorkflow(newName.trim());
    setNewName("");
    refresh();
  }

  async function handleDelete(id: string) {
    await bridgeClient.deleteWorkflow(id);
    if (id === currentWorkflowId) closeWorkflow();
    refresh();
  }

  return (
    <section aria-label="Workflow">
      <h2>Workflow</h2>

      <form onSubmit={handleCreate}>
        <label htmlFor="new-workflow-name">Nuovo workflow</label>
        <input
          id="new-workflow-name"
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome del workflow"
        />
        <button type="submit" disabled={storeLoading || !newName.trim()}>
          Crea e apri
        </button>
      </form>

      {error && <p className="settings-panel__feedback--error">{error}</p>}
      {storeError && (
        <p role="alert" className="settings-panel__feedback--error">
          {storeError}
        </p>
      )}

      <ul className="models-panel__list">
        {(workflows ?? []).map((w) => (
          <li key={w.id} className="models-panel__item">
            <span className="models-panel__name">
              {w.name}
              {w.id === currentWorkflowId ? " (aperto)" : ""}
            </span>
            <span className="models-panel__meta">
              {w.node_count} nodi · {w.edge_count} collegamenti
            </span>
            <button type="button" onClick={() => void openWorkflow(w.id)} disabled={w.id === currentWorkflowId}>
              Apri
            </button>
            <button type="button" onClick={() => void handleDelete(w.id)}>
              Elimina
            </button>
          </li>
        ))}
        {workflows && workflows.length === 0 && <p>Nessun workflow ancora creato.</p>}
      </ul>

      {currentWorkflowId && validationIssues.length > 0 && (
        <>
          <h3>Validazione</h3>
          <ul className="models-panel__list">
            {validationIssues.map((issue, i) => (
              <li key={i} className="models-panel__item">
                <span className={issue.severity === "error" ? "settings-panel__feedback--error" : "settings-panel__hint"}>
                  {issue.severity === "error" ? "⛔" : "⚠️"} {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
