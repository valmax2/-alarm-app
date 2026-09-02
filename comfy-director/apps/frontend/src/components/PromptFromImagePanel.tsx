import { Fragment, useEffect, useState } from "react";

import {
  bridgeClient,
  type AIProviderKind,
  type AIProviderOut,
  type StructuredPromptOut,
} from "../api/bridgeClient";

const FIELD_LABELS: Array<[keyof StructuredPromptOut, string]> = [
  ["subject", "Soggetto"],
  ["identity", "Identità / caratteristiche visibili"],
  ["hair", "Capelli"],
  ["face", "Volto"],
  ["body_clothing", "Corpo / abbigliamento"],
  ["pose_action", "Posa / azione"],
  ["environment", "Ambiente"],
  ["camera", "Camera"],
  ["light", "Luce"],
  ["style", "Stile"],
  ["details", "Dettagli"],
];

type AnalyzeStatus = "idle" | "loading" | "done" | "error";

/**
 * PROMPT DA IMMAGINE (spec §9). Richiede un provider AI cloud configurato dall'utente
 * (Anthropic o OpenAI, con una chiave propria — mai una nostra nascosta, spec §20).
 * La modalità "locale" (VLM sul PC dell'utente) è prevista nello schema ma non ancora
 * implementata: dichiarato esplicitamente, mai finto.
 */
export function PromptFromImagePanel() {
  const [providers, setProviders] = useState<AIProviderOut[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newKind, setNewKind] = useState<AIProviderKind>("anthropic");
  const [newLabel, setNewLabel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [structured, setStructured] = useState<StructuredPromptOut | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  function loadProviders() {
    bridgeClient
      .getAIProviders()
      .then((list) => {
        setProviders(list);
        setProvidersError(null);
        if (!selectedProviderId && list.length > 0) setSelectedProviderId(list[0].id);
      })
      .catch((err: unknown) => setProvidersError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(loadProviders, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddProvider(event: React.FormEvent) {
    event.preventDefault();
    setAddError(null);
    try {
      await bridgeClient.createAIProvider({
        kind: newKind,
        label: newLabel || (newKind === "anthropic" ? "Anthropic" : newKind === "openai" ? "OpenAI" : "Locale"),
        api_key: newApiKey || undefined,
      });
      setNewLabel("");
      setNewApiKey("");
      setShowAddForm(false);
      loadProviders();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteProvider(id: string) {
    await bridgeClient.deleteAIProvider(id);
    if (selectedProviderId === id) setSelectedProviderId("");
    loadProviders();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedProviderId) return;
    setAnalyzeStatus("loading");
    setAnalyzeError(null);
    setStructured(null);
    try {
      const response = await bridgeClient.promptFromImage(file, selectedProviderId);
      setStructured(response.structured);
      setAnalyzeStatus("done");
    } catch (err) {
      setAnalyzeStatus("error");
      setAnalyzeError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section aria-label="Prompt da Immagine">
      <h2>Prompt da Immagine</h2>

      <h3>Provider AI</h3>
      {providersError && (
        <p role="alert" className="settings-panel__feedback--error">
          {providersError}
        </p>
      )}
      {providers.length === 0 && !providersError && (
        <p>Nessun provider configurato. Aggiungine uno per poter analizzare immagini.</p>
      )}
      <ul className="models-panel__list">
        {providers.map((p) => (
          <li key={p.id} className="models-panel__item">
            <span className="models-panel__name">{p.label}</span>
            <span className="models-panel__meta">
              {p.kind}
              {p.has_api_key ? " · chiave configurata" : " · nessuna chiave"}
            </span>
            <button type="button" onClick={() => handleDeleteProvider(p.id)}>
              Elimina
            </button>
          </li>
        ))}
      </ul>

      {!showAddForm && (
        <button type="button" onClick={() => setShowAddForm(true)}>
          Aggiungi provider
        </button>
      )}
      {showAddForm && (
        <form onSubmit={handleAddProvider}>
          <label htmlFor="provider-kind">Tipo</label>
          <select
            id="provider-kind"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as AIProviderKind)}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
            <option value="local">Locale (non ancora implementato)</option>
          </select>

          <label htmlFor="provider-label">Nome</label>
          <input id="provider-label" type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />

          {newKind !== "local" && (
            <>
              <label htmlFor="provider-api-key">API key</label>
              <input
                id="provider-api-key"
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                autoComplete="off"
              />
            </>
          )}

          <button type="submit">Salva provider</button>
          <button type="button" onClick={() => setShowAddForm(false)}>
            Annulla
          </button>
          {addError && (
            <p role="alert" className="settings-panel__feedback--error">
              {addError}
            </p>
          )}
        </form>
      )}

      <hr />

      <h3>Analizza immagine</h3>
      {providers.length > 0 && (
        <>
          <label htmlFor="analyze-provider">Provider da usare</label>
          <select
            id="analyze-provider"
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        aria-label="Carica immagine da analizzare"
        onChange={handleFileChange}
        disabled={analyzeStatus === "loading" || !selectedProviderId}
      />

      {analyzeStatus === "loading" && <p>Analisi in corso…</p>}
      {analyzeStatus === "error" && analyzeError && (
        <p role="alert" className="settings-panel__feedback--error">
          {analyzeError}
        </p>
      )}

      {analyzeStatus === "done" && structured && (
        <dl className="settings-panel__sync-report">
          {FIELD_LABELS.map(([key, label]) => (
            <Fragment key={key}>
              <dt>{label}</dt>
              <dd>{structured[key]}</dd>
            </Fragment>
          ))}
          <dt>Prompt finale EN</dt>
          <dd>
            <textarea readOnly value={structured.final_prompt_en} rows={4} style={{ width: "100%" }} />
            <button type="button" onClick={() => navigator.clipboard?.writeText(structured.final_prompt_en)}>
              Copia
            </button>
          </dd>
        </dl>
      )}
    </section>
  );
}
