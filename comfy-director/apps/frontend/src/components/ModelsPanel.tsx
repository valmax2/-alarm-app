import { useCallback, useEffect, useMemo, useState } from "react";

import { bridgeClient, type ModelOut } from "../api/bridgeClient";

const COMPATIBILITY_LABEL: Record<string, string> = {
  compatible: "✅ Compatibile",
  incompatible: "⛔ Incompatibile",
  warning: "⚠️ Incerto",
  unknown: "❔ Non verificato",
};

/**
 * Pannello Modelli (Fase 2 + Fase 4 v1). Reale: legge da /inventory/models, che a sua
 * volta riflette l'ultima sincronizzazione (§3 §5 §14 della spec) — nessun dato finto.
 * Il filtro famiglia usa il Compatibility Engine (bridge.compatibility): un modello
 * mostra sempre il proprio esito (compatible/incompatible/warning/unknown) con motivo,
 * mai un'esclusione silenziosa.
 */
export function ModelsPanel() {
  const [allModels, setAllModels] = useState<ModelOut[] | null>(null);
  const [models, setModels] = useState<ModelOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [family, setFamily] = useState("");
  const [modelType, setModelType] = useState("");
  const [query, setQuery] = useState("");
  const [includeIncompatible, setIncludeIncompatible] = useState(false);

  // Prima chiamata non filtrata: usata per popolare i menu famiglia/tipo con i valori
  // REALMENTE presenti nell'inventario (mai un elenco statico inventato).
  useEffect(() => {
    bridgeClient
      .getModels()
      .then(setAllModels)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const refresh = useCallback(() => {
    bridgeClient
      .getModels({
        family: family || undefined,
        model_type: modelType || undefined,
        q: query || undefined,
        include_incompatible: includeIncompatible,
      })
      .then(setModels)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [family, modelType, query, includeIncompatible]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const families = useMemo(() => {
    if (!allModels) return [];
    return Array.from(new Set(allModels.map((m) => m.family).filter((f): f is string => !!f))).sort();
  }, [allModels]);

  const types = useMemo(() => {
    if (!allModels) return [];
    return Array.from(new Set(allModels.map((m) => m.model_type))).sort();
  }, [allModels]);

  if (error) {
    return (
      <section aria-label="Modelli">
        <h2>Modelli</h2>
        <p role="alert">{error}</p>
      </section>
    );
  }

  if (allModels === null) {
    return (
      <section aria-label="Modelli">
        <h2>Modelli</h2>
        <p>Caricamento…</p>
      </section>
    );
  }

  if (allModels.length === 0) {
    return (
      <section aria-label="Modelli">
        <h2>Modelli</h2>
        <p>
          Nessun modello in inventario. Vai su "Bridge ComfyUI" e premi "Sincronizza
          ComfyUI" (richiede ComfyUI acceso, oppure un percorso ComfyUI configurato).
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Modelli">
      <h2>Modelli</h2>
      <div className="models-panel__filters">
        <label htmlFor="models-family">Famiglia</label>
        <select id="models-family" value={family} onChange={(e) => setFamily(e.target.value)}>
          <option value="">Tutte</option>
          {families.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <label htmlFor="models-type">Tipo</label>
        <select id="models-type" value={modelType} onChange={(e) => setModelType(e.target.value)}>
          <option value="">Tutti</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label htmlFor="models-search">Cerca</label>
        <input id="models-search" type="text" value={query} onChange={(e) => setQuery(e.target.value)} />

        {family && (
          <label className="models-panel__checkbox">
            <input
              type="checkbox"
              checked={includeIncompatible}
              onChange={(e) => setIncludeIncompatible(e.target.checked)}
            />
            Mostra incompatibili
          </label>
        )}
      </div>

      <ul className="models-panel__list">
        {(models ?? []).map((m) => (
          <li key={m.id} className="models-panel__item">
            <span className="models-panel__name">{m.name}</span>
            <span className="models-panel__meta">
              {m.model_type} · {m.family ?? "famiglia sconosciuta"} · confidenza{" "}
              {(m.detection_confidence * 100).toFixed(0)}% ({m.detection_source})
            </span>
            {m.compatibility && (
              <span
                className={`models-panel__compat models-panel__compat--${m.compatibility}`}
                title={m.compatibility_reason ?? undefined}
              >
                {COMPATIBILITY_LABEL[m.compatibility]}
              </span>
            )}
          </li>
        ))}
      </ul>
      {models && models.length === 0 && <p>Nessun modello corrisponde ai filtri correnti.</p>}
    </section>
  );
}
