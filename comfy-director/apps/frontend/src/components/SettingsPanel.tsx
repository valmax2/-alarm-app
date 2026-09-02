import { useEffect, useState } from "react";

import { bridgeClient, type SyncResponse } from "../api/bridgeClient";

type SaveState = "idle" | "saving" | "saved" | "error";
type SyncState = "idle" | "syncing" | "done" | "error";

/**
 * Form per configurare l'URL di ComfyUI e il percorso locale della sua installazione
 * (spec §3: "Non assumere però percorsi fissi"). Il percorso ComfyUI è opzionale: se
 * vuoto, l'inventario si basa solo su /object_info (ComfyUI deve essere acceso); se
 * impostato e leggibile dal processo Bridge, la sincronizzazione legge anche
 * direttamente i file sul disco (funziona pure a ComfyUI spento — vedi
 * docs/data-model.md e ARCHITECTURE_DECISION.md).
 *
 * Cartella modelli/custom_nodes separate e directory workflow multiple restano non
 * ancora configurabili qui — dichiarato esplicitamente, arrivano più avanti.
 */
export function SettingsPanel() {
  const [comfyBaseUrl, setComfyBaseUrl] = useState("");
  const [comfyRootPath, setComfyRootPath] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bridgeClient
      .getSettings()
      .then((settings) => {
        if (!cancelled) {
          setComfyBaseUrl(settings.comfy_base_url);
          setComfyRootPath(settings.comfy_root_path ?? "");
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaveState("saving");
    setError(null);
    try {
      const updated = await bridgeClient.updateSettings(comfyBaseUrl, comfyRootPath || null);
      setComfyBaseUrl(updated.comfy_base_url);
      setComfyRootPath(updated.comfy_root_path ?? "");
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSync() {
    setSyncState("syncing");
    setSyncError(null);
    try {
      const report = await bridgeClient.syncComfy();
      setSyncResult(report);
      setSyncState("done");
    } catch (err) {
      setSyncState("error");
      setSyncError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="settings-panel" aria-label="Impostazioni Bridge ComfyUI">
      <h2>Bridge ComfyUI</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="comfy-base-url">URL ComfyUI</label>
        <input
          id="comfy-base-url"
          type="text"
          value={comfyBaseUrl}
          placeholder="http://127.0.0.1:8188"
          disabled={!loaded}
          onChange={(event) => setComfyBaseUrl(event.target.value)}
        />
        <label htmlFor="comfy-root-path">Percorso installazione ComfyUI (opzionale)</label>
        <input
          id="comfy-root-path"
          type="text"
          value={comfyRootPath}
          placeholder="es. C:\ComfyUI oppure C:\ComfyUI\models"
          disabled={!loaded}
          onChange={(event) => setComfyRootPath(event.target.value)}
        />
        <p className="settings-panel__hint">
          Serve al Bridge per leggere i file modello direttamente dal disco (dimensione,
          famiglia da metadata reali) — funziona anche se ComfyUI non è in esecuzione.
          Va eseguito sul PC dove si trova quella cartella: qui puoi indicare sia la
          cartella radice di ComfyUI sia direttamente la sua cartella "models".
        </p>
        <button type="submit" disabled={!loaded || saveState === "saving"}>
          {saveState === "saving" ? "Salvataggio…" : "Salva"}
        </button>
      </form>
      {saveState === "saved" && <p className="settings-panel__feedback">Impostazioni salvate.</p>}
      {error && (
        <p className="settings-panel__feedback settings-panel__feedback--error" role="alert">
          {error}
        </p>
      )}

      <hr />

      <h3>Sincronizza ComfyUI</h3>
      <button type="button" onClick={handleSync} disabled={syncState === "syncing"}>
        {syncState === "syncing" ? "Sincronizzazione…" : "Sincronizza ComfyUI"}
      </button>
      {syncState === "done" && syncResult && (
        <dl className="settings-panel__sync-report" aria-label="Risultato sincronizzazione">
          <dt>ComfyUI</dt>
          <dd>{syncResult.comfy_status === "online" ? `Online (v${syncResult.comfy_version ?? "?"})` : "Offline"}</dd>
          <dt>Nodi</dt>
          <dd>{syncResult.node_count}</dd>
          <dt>Custom node</dt>
          <dd>{syncResult.custom_node_count}</dd>
          <dt>Modelli</dt>
          <dd>
            {syncResult.model_count}
            {Object.entries(syncResult.model_counts_by_type).length > 0 && (
              <>
                {" "}
                (
                {Object.entries(syncResult.model_counts_by_type)
                  .map(([type, count]) => `${type}: ${count}`)
                  .join(", ")}
                )
              </>
            )}
          </dd>
          <dt>Scansione filesystem</dt>
          <dd>{syncResult.filesystem_scan_used ? "usata" : "non usata (nessun percorso configurato)"}</dd>
          <dt>Ultima sincronizzazione</dt>
          <dd>{new Date(syncResult.synced_at).toLocaleString("it-IT")}</dd>
        </dl>
      )}
      {syncError && (
        <p className="settings-panel__feedback settings-panel__feedback--error" role="alert">
          {syncError}
        </p>
      )}

      <p className="settings-panel__note">
        Cartelle separate per custom_nodes e directory workflow multiple non sono ancora
        configurabili qui. Vedi IMPLEMENTATION_PLAN.md.
      </p>
    </section>
  );
}
