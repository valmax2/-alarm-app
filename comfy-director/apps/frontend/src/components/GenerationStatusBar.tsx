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
 * footer. Stato di base aggiornato per polling REST (fonte di verità); se il relay WS
 * live (Fase 6 v2, generationStore.ts) è connesso, mostra anche il nodo in esecuzione
 * e una percentuale di avanzamento reali — mai inventati: entrambi restano assenti
 * finché nessun evento WS è arrivato (degradazione automatica a v1). */
export function GenerationStatusBar() {
  const generation = useGenerationStore((s) => s.current);
  const error = useGenerationStore((s) => s.error);

  if (!generation) {
    return <span>Nessuna generazione avviata. Prompt / Log restano non ancora implementati (Fasi 9, 11).</span>;
  }

  const hasLiveProgress = generation.progress_value !== null && generation.progress_max !== null && generation.progress_max > 0;

  return (
    <div className="generation-status-bar">
      <span className={`generation-status-bar__label generation-status-bar__label--${generation.status}`}>
        Generazione: {STATUS_LABELS[generation.status] ?? generation.status}
      </span>
      {(generation.status === "running" || generation.status === "queued") && generation.current_node_id && (
        <span className="generation-status-bar__live-node" title="Nodo in esecuzione (relay WS live)">
          nodo {generation.current_node_id}
        </span>
      )}
      {(generation.status === "running" || generation.status === "queued") && hasLiveProgress && (
        <span className="generation-status-bar__live-progress">
          <progress value={generation.progress_value ?? 0} max={generation.progress_max ?? 1} />
          {generation.progress_value}/{generation.progress_max}
        </span>
      )}
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
