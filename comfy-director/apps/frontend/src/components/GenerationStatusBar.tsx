import { bridgeClient } from "../api/bridgeClient";
import { useGenerationStore } from "../store/generationStore";

const STATUS_LABELS: Record<string, string> = {
  queued: "In coda…",
  running: "In esecuzione…",
  completed: "Completata",
  error: "Errore",
  aborted: "Interrotta",
};

/** Barra di stato della generazione (Fase 6) — sostituisce il placeholder statico del
 * footer. Stato aggiornato per polling (nessuna relay WS in questa consegna, vedi
 * generationStore.ts): mai una percentuale di progresso finta, solo lo stato reale
 * dell'ultima risposta del Bridge. */
export function GenerationStatusBar() {
  const generation = useGenerationStore((s) => s.current);
  const error = useGenerationStore((s) => s.error);

  if (!generation) {
    return <span>Nessuna generazione avviata. Prompt / Log restano non ancora implementati (Fasi 9, 11).</span>;
  }

  return (
    <div className="generation-status-bar">
      <span className={`generation-status-bar__label generation-status-bar__label--${generation.status}`}>
        Generazione: {STATUS_LABELS[generation.status] ?? generation.status}
      </span>
      {generation.status === "error" && generation.error_message && (
        <span className="settings-panel__feedback--error">{generation.error_message}</span>
      )}
      {generation.node_errors && (
        <span className="settings-panel__feedback--error">
          Errori riportati da ComfyUI: {JSON.stringify(generation.node_errors)}
        </span>
      )}
      {error && <span className="settings-panel__feedback--error">{error}</span>}
      {generation.status === "completed" && generation.outputs.length === 0 && (
        <span className="settings-panel__hint">Completata, ma nessun output riconosciuto nello storico di ComfyUI.</span>
      )}
      {generation.outputs.length > 0 && (
        <div className="generation-status-bar__outputs">
          {generation.outputs.map((output, index) => (
            <a
              key={`${output.filename}-${index}`}
              href={bridgeClient.generationOutputUrl(generation.id, index)}
              target="_blank"
              rel="noreferrer"
              title={output.filename}
            >
              <img
                src={bridgeClient.generationOutputUrl(generation.id, index)}
                alt={output.filename}
                className="generation-status-bar__thumb"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
