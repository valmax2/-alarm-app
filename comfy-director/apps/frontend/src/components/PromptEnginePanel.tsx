import { useEffect, useState } from "react";

import {
  bridgeClient,
  type AIProviderOut,
  type ApplyPromptResponse,
  type PromptOut,
  type PromptPresetOut,
  type WorkflowSummaryOut,
} from "../api/bridgeClient";
import { StructuredPromptBuilder } from "./StructuredPromptBuilder";

/**
 * Prompt Engine (Fase 9, spec §9) — completamento della parte rimasta dopo "Prompt da
 * Immagine" (Fase 9 parziale, portata avanti in precedenza): scrittura manuale di un
 * prompt, traduzione IT→EN reale, blocco traduzione, negative prompt, cronologia.
 *
 * Fase 9 v2 aggiunge i preset (nome, categoria, tag) — distinti dalla cronologia: la
 * cronologia si popola automaticamente ad ogni salvataggio, un preset è curato
 * dall'utente per essere richiamato rapidamente.
 *
 * Aggiunge la "Costruzione guidata" (`StructuredPromptBuilder`, Smart Prompt
 * Compiler + Coerenza Personaggio, portato da PromptStudio su richiesta esplicita
 * dell'utente): compone il prompt inglese da menu guidati invece di scriverlo a
 * mano, riusando i Personaggi della libreria (Fase 7) per la coerenza d'identità.
 *
 * "Invia al workflow" chiude il divario dichiarato in precedenza ("non ancora
 * collegato a un workflow specifico"): individua strutturalmente (mai indovinato —
 * bridge.workflow.prompt_targets) il nodo di testo libero collegato a
 * 'positive'/'negative' nel workflow scelto e vi scrive il prompt corrente, senza
 * che l'utente debba ricopiarlo a mano sulla canvas. Resta esplicitamente NON
 * collegato: la generazione stessa (il pulsante GENERA vive nel pannello Workflow,
 * non qui) e qualunque nodo che non abbia un candidato univoco (l'errore reale del
 * Bridge spiega perché, mai un fallimento silenzioso).
 */
export function PromptEnginePanel() {
  const [providers, setProviders] = useState<AIProviderOut[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  const [textIt, setTextIt] = useState("");
  const [textEn, setTextEn] = useState("");
  const [negativeTextEn, setNegativeTextEn] = useState("");
  const [translationLocked, setTranslationLocked] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const [history, setHistory] = useState<PromptOut[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [workflows, setWorkflows] = useState<WorkflowSummaryOut[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyPromptResponse | null>(null);

  const [presets, setPresets] = useState<PromptPresetOut[] | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [presetTags, setPresetTags] = useState<string[]>([]);
  const [presetFilterTag, setPresetFilterTag] = useState("");
  const [presetSearch, setPresetSearch] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetCategory, setNewPresetCategory] = useState("");
  const [newPresetTags, setNewPresetTags] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

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

  function loadHistory() {
    bridgeClient
      .listPrompts()
      .then((list) => {
        setHistory(list);
        setHistoryError(null);
      })
      .catch((err: unknown) => setHistoryError(err instanceof Error ? err.message : String(err)));
  }

  function loadPresets() {
    bridgeClient
      .listPromptPresets({ tag: presetFilterTag || undefined, q: presetSearch || undefined })
      .then((list) => {
        setPresets(list);
        setPresetsError(null);
      })
      .catch((err: unknown) => setPresetsError(err instanceof Error ? err.message : String(err)));
    bridgeClient.listPromptPresetTags().then(setPresetTags).catch(() => undefined);
  }

  function loadWorkflows() {
    bridgeClient
      .listWorkflows()
      .then((list) => {
        if (!Array.isArray(list)) return;
        setWorkflows(list);
        setSelectedWorkflowId((current) => current || (list[0]?.id ?? ""));
      })
      // Non bloccante: se il caricamento fallisce (es. Bridge appena avviato), la
      // sezione "Invia al workflow" resta semplicemente senza opzioni — l'utente
      // può comunque scrivere/tradurre/salvare il prompt normalmente.
      .catch(() => undefined);
  }

  useEffect(loadProviders, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadHistory, []);
  useEffect(loadWorkflows, []);
  useEffect(loadPresets, [presetFilterTag, presetSearch]);

  async function handleTranslate() {
    if (!textIt.trim() || !selectedProviderId || translationLocked) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const result = await bridgeClient.translatePrompt(textIt.trim(), selectedProviderId);
      setTextEn(result.text_en);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : String(err));
    } finally {
      setTranslating(false);
    }
  }

  async function handleSave() {
    if (!textEn.trim()) return;
    await bridgeClient.createPrompt({
      text_it: textIt.trim() || null,
      text_en: textEn.trim(),
      negative_text_en: negativeTextEn.trim() || null,
      translation_locked: translationLocked,
    });
    loadHistory();
  }

  async function handleApplyToWorkflow() {
    if (!textEn.trim() || !selectedWorkflowId) return;
    setApplying(true);
    setApplyError(null);
    setApplyResult(null);
    try {
      const result = await bridgeClient.applyPromptToWorkflow(selectedWorkflowId, textEn.trim(), negativeTextEn.trim() || undefined);
      setApplyResult(result);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  async function handleDeleteHistoryEntry(id: string) {
    await bridgeClient.deletePrompt(id);
    loadHistory();
  }

  function applyToEditor(source: { text_it: string | null; text_en: string; negative_text_en: string | null }) {
    setTextIt(source.text_it ?? "");
    setTextEn(source.text_en);
    setNegativeTextEn(source.negative_text_en ?? "");
  }

  function handleReuse(prompt: PromptOut) {
    applyToEditor(prompt);
    setTranslationLocked(prompt.translation_locked);
  }

  function handleUsePreset(preset: PromptPresetOut) {
    applyToEditor(preset);
    // Il testo inglese del preset è già quello curato dall'utente: bloccare la
    // traduzione evita che un ritraduci accidentale lo sovrascriva.
    setTranslationLocked(true);
  }

  async function handleSaveAsPreset() {
    if (!newPresetName.trim() || !textEn.trim()) return;
    setSavingPreset(true);
    setPresetsError(null);
    try {
      const tags = newPresetTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await bridgeClient.createPromptPreset({
        name: newPresetName.trim(), category: newPresetCategory.trim() || null, tags,
        text_it: textIt.trim() || null, text_en: textEn.trim(), negative_text_en: negativeTextEn.trim() || null,
      });
      setNewPresetName("");
      setNewPresetCategory("");
      setNewPresetTags("");
      loadPresets();
    } catch (err) {
      setPresetsError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPreset(false);
    }
  }

  async function handleDeletePreset(id: string) {
    await bridgeClient.deletePromptPreset(id);
    loadPresets();
  }

  return (
    <section aria-label="Prompt Engine">
      <h2>Prompt Engine</h2>
      <p className="settings-panel__hint">
        Scrivi un prompt e traducilo in inglese con il provider AI configurato, poi invialo direttamente a un
        workflow — sotto trovi anche i preset riutilizzabili e la cronologia di tutti i prompt salvati.
      </p>

      {providersError && (
        <p role="alert" className="settings-panel__feedback--error">
          {providersError}
        </p>
      )}
      {providers.length === 0 && !providersError && (
        <p>Nessun provider configurato. Aggiungine uno in "Prompt da Immagine" per poter tradurre.</p>
      )}
      {providers.length > 0 && (
        <>
          <label htmlFor="prompt-engine-provider">Provider per la traduzione</label>
          <select id="prompt-engine-provider" value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </>
      )}

      <StructuredPromptBuilder onComposed={setTextEn} />

      <form onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="prompt-it">Prompt (italiano)</label>
        <textarea id="prompt-it" value={textIt} onChange={(e) => setTextIt(e.target.value)} rows={3} />
        <button type="button" onClick={() => void handleTranslate()} disabled={!textIt.trim() || !selectedProviderId || translating || translationLocked}>
          {translating ? "Traduzione…" : "Traduci in inglese"}
        </button>
        {translateError && (
          <p role="alert" className="settings-panel__feedback--error">
            {translateError}
          </p>
        )}

        <label htmlFor="prompt-en">Prompt (inglese) — editabile</label>
        <textarea id="prompt-en" value={textEn} onChange={(e) => setTextEn(e.target.value)} rows={3} />

        <label htmlFor="prompt-negative">Negative prompt (inglese, opzionale)</label>
        <textarea id="prompt-negative" value={negativeTextEn} onChange={(e) => setNegativeTextEn(e.target.value)} rows={2} />

        <label>
          <input
            type="checkbox"
            checked={translationLocked}
            onChange={(e) => setTranslationLocked(e.target.checked)}
          />{" "}
          Blocca traduzione (non sovrascrivere il testo inglese se traduco di nuovo)
        </label>

        <button type="button" onClick={() => void handleSave()} disabled={!textEn.trim()}>
          Salva nella cronologia
        </button>
      </form>

      <div className="prompt-engine__apply-to-workflow">
        <h3>Invia al workflow</h3>
        {workflows.length === 0 ? (
          <p className="settings-panel__hint">Nessun workflow ancora creato — crealo dal pannello Workflow per poterci inviare questo prompt.</p>
        ) : (
          <>
            <label htmlFor="prompt-apply-workflow">Workflow di destinazione</label>
            <select id="prompt-apply-workflow" value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)}>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void handleApplyToWorkflow()} disabled={!textEn.trim() || !selectedWorkflowId || applying}>
              {applying ? "Invio…" : "Invia il prompt a questo workflow"}
            </button>
            <p className="settings-panel__note">
              Cerca nel workflow il nodo di testo libero collegato all'input "positive" (e, se presente,
              "negative") e vi scrive il prompt qui sopra — nessuna copia-incolla manuale. Se il workflow non ha
              un candidato univoco, l'errore reale spiega perché (mai un abbinamento indovinato).
            </p>
          </>
        )}
        {applyError && (
          <p role="alert" className="settings-panel__feedback--error">
            {applyError}
          </p>
        )}
        {applyResult && (
          <p className="settings-panel__feedback">
            Prompt inserito nel nodo "{applyResult.applied.find((a) => a.role === "positive")?.class_type}"
            {applyResult.applied.some((a) => a.role === "negative") ? " (positivo + negativo)" : " (positivo)"} —
            nuova versione {applyResult.workflow.version_number} del workflow.
            {applyResult.warnings.map((w) => (
              <span key={w} className="settings-panel__note">
                {" "}
                {w}
              </span>
            ))}
          </p>
        )}
      </div>

      <hr />

      <h3>Preset</h3>
      <p className="settings-panel__hint">
        Salva il prompt corrente come preset riutilizzabile, con nome, categoria e tag — a differenza della
        cronologia (sotto), un preset è curato da te, non un salvataggio automatico.
      </p>
      <form onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="preset-name">Nome del preset</label>
        <input id="preset-name" type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} />
        <label htmlFor="preset-category">Categoria (opzionale)</label>
        <input id="preset-category" type="text" value={newPresetCategory} onChange={(e) => setNewPresetCategory(e.target.value)} />
        <label htmlFor="preset-tags">Tag (separati da virgola, opzionale)</label>
        <input id="preset-tags" type="text" value={newPresetTags} onChange={(e) => setNewPresetTags(e.target.value)} />
        <button type="button" onClick={() => void handleSaveAsPreset()} disabled={!newPresetName.trim() || !textEn.trim() || savingPreset}>
          {savingPreset ? "Salvataggio…" : "Salva come preset"}
        </button>
      </form>

      {presetsError && (
        <p role="alert" className="settings-panel__feedback--error">
          {presetsError}
        </p>
      )}

      <label htmlFor="preset-search">Cerca preset per nome</label>
      <input id="preset-search" type="text" value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)} />
      {presetTags.length > 0 && (
        <>
          <label htmlFor="preset-tag-filter">Filtra per tag</label>
          <select id="preset-tag-filter" value={presetFilterTag} onChange={(e) => setPresetFilterTag(e.target.value)}>
            <option value="">Tutti i tag</option>
            {presetTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </>
      )}

      <ul className="models-panel__list">
        {(presets ?? []).map((preset) => (
          <li key={preset.id} className="models-panel__item">
            <span className="models-panel__name">{preset.name}</span>
            <span className="models-panel__meta">
              {preset.category ? `${preset.category} · ` : ""}
              {preset.tags.length > 0 ? preset.tags.join(", ") : "nessun tag"}
            </span>
            <button type="button" onClick={() => handleUsePreset(preset)}>
              Usa
            </button>
            <button type="button" onClick={() => void handleDeletePreset(preset.id)}>
              Elimina
            </button>
          </li>
        ))}
        {presets && presets.length === 0 && <p>Nessun preset trovato.</p>}
      </ul>

      <hr />

      <h3>Cronologia</h3>
      {historyError && (
        <p role="alert" className="settings-panel__feedback--error">
          {historyError}
        </p>
      )}
      <ul className="models-panel__list">
        {(history ?? []).map((p) => (
          <li key={p.id} className="models-panel__item">
            <span className="models-panel__name">{p.text_en}</span>
            {p.text_it && <span className="models-panel__meta">IT: {p.text_it}</span>}
            <button type="button" onClick={() => handleReuse(p)}>
              Riusa
            </button>
            <button type="button" onClick={() => void handleDeleteHistoryEntry(p.id)}>
              Elimina
            </button>
          </li>
        ))}
        {history && history.length === 0 && <p>Nessun prompt ancora salvato.</p>}
      </ul>
    </section>
  );
}
