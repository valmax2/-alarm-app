import { useEffect, useState } from "react";

import { bridgeClient, type ErrorLogOut } from "../api/bridgeClient";

/**
 * Diagnostica (Fase 11 v1, spec §25/§34). Mostra SOLO le eccezioni non gestite
 * catturate dall'exception handler globale del Bridge (`bridge/diagnostics.py`) — non
 * gli errori già convertiti in una risposta HTTP pulita da un router (404/409/502/...),
 * già comunicati onestamente all'utente al momento stesso. Dichiarato esplicitamente.
 */
export function DiagnosticsPanel() {
  const [errors, setErrors] = useState<ErrorLogOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  function refresh() {
    bridgeClient
      .listErrors()
      .then((list) => {
        setErrors(list);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(refresh, []);

  async function handleDownloadReport() {
    setDownloading(true);
    try {
      const report = await bridgeClient.getDiagnosticsReport();
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `comfy-director-diagnostics-${report.generated_at.slice(0, 19).replace(/[:T]/g, "-")}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-label="Diagnostica">
      <h2>Diagnostica</h2>
      <p className="settings-panel__hint">
        Errori non gestiti catturati automaticamente dal Bridge (dal primo giorno, spec §25). Gli errori già mostrati
        chiaramente altrove nell'app (es. "provider non trovato", "ComfyUI non raggiungibile") non compaiono qui: sono
        già stati comunicati onestamente al momento stesso, questa è la rete di sicurezza per tutto il resto.
      </p>

      <button type="button" onClick={() => void handleDownloadReport()} disabled={downloading}>
        {downloading ? "Preparazione…" : "Scarica report diagnostico"}
      </button>
      <button type="button" onClick={refresh}>
        Aggiorna
      </button>

      {error && (
        <p role="alert" className="settings-panel__feedback--error">
          {error}
        </p>
      )}

      <ul className="models-panel__list">
        {(errors ?? []).map((e) => (
          <li key={e.id} className="models-panel__item">
            <span className="models-panel__name">{e.source}</span>
            <span className="settings-panel__feedback--error">{e.message}</span>
            <span className="models-panel__meta">
              {e.level} · {new Date(e.created_at).toLocaleString("it-IT")}
            </span>
          </li>
        ))}
        {errors && errors.length === 0 && <p>Nessun errore registrato. Buon segno.</p>}
      </ul>
    </section>
  );
}
