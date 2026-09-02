import { useEffect, useState } from "react";

import { bridgeClient, type WorkflowSummaryOut } from "../api/bridgeClient";
import { useWorkflowStore } from "../store/workflowStore";

/** `File.text()` non è implementato in tutti gli ambienti (es. jsdom nei test) —
 * `FileReader` è supportato ovunque, incluso il browser reale. */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Lettura del file fallita"));
    reader.readAsText(file);
  });
}

/** Libreria workflow minimale (Fase 3): crea/apri/elimina. Duplica/rinomina/tag/
 * ricerca restano per la Fase 5 (Libreria Workflow completa, spec §7). */
export function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<WorkflowSummaryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newFamily, setNewFamily] = useState("");
  const [knownFamilies, setKnownFamilies] = useState<string[]>([]);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const currentWorkflowId = useWorkflowStore((s) => s.workflowId);
  const validationIssues = useWorkflowStore((s) => s.validationIssues);
  const storeLoading = useWorkflowStore((s) => s.loading);
  const storeError = useWorkflowStore((s) => s.error);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const importWorkflowJson = useWorkflowStore((s) => s.importWorkflowJson);
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
  // Elenco famiglie note (spec: "scegliere tra i vari WAN/Qwen/...") — dal Bridge,
  // mai una lista duplicata a mano nel frontend.
  useEffect(() => {
    bridgeClient.getKnownFamilies().then(setKnownFamilies).catch(() => setKnownFamilies([]));
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    await newWorkflow(newName.trim(), newFamily || null);
    setNewName("");
    setNewFamily("");
    refresh();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permette di reimportare lo stesso file consecutivamente
    if (!file) return;
    setImportFeedback(null);
    const text = await readFileAsText(file);
    const baseName = file.name.replace(/\.json$/i, "");
    const result = await importWorkflowJson(baseName || "Workflow importato", text);
    if (result) {
      const formatLabel = result.source === "prompt" ? "formato API" : "formato UI";
      const warning =
        result.unmappedWidgetNodeTypes.length > 0
          ? ` Attenzione: i valori dei widget di ${result.unmappedWidgetNodeTypes.join(", ")} non sono stati importati (tipo di nodo non nell'ultimo inventario sincronizzato — sincronizza e reimporta per averli).`
          : "";
      setImportFeedback(`Importato (${formatLabel}).${warning}`);
    }
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
        <label htmlFor="new-workflow-family">Famiglia (opzionale)</label>
        <select id="new-workflow-family" value={newFamily} onChange={(e) => setNewFamily(e.target.value)}>
          <option value="">Non specificata</option>
          {knownFamilies.map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()}
            </option>
          ))}
        </select>
        <p className="settings-panel__hint">
          Solo un'etichetta salvata sul workflow, per ora: non genera ancora nodi né filtra automaticamente i modelli
          (arriva con la Fase 5 completa — qui puoi già impostarla, il filtro modelli per famiglia nel pannello
          "Modelli" resta per ora una scelta manuale separata).
        </p>
        <button type="submit" disabled={storeLoading || !newName.trim()}>
          Crea e apri
        </button>
      </form>

      <label htmlFor="import-workflow-json">Oppure importa da file .json ComfyUI</label>
      <input id="import-workflow-json" type="file" accept="application/json,.json" onChange={(e) => void handleImportFile(e)} />
      {importFeedback && <p className="settings-panel__hint">{importFeedback}</p>}

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
              {w.node_count} nodi · {w.edge_count} collegamenti{w.family ? ` · ${w.family.toUpperCase()}` : ""}
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
