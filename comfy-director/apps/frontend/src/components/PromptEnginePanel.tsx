import { useEffect, useState } from "react";

import { bridgeClient, type AIProviderOut, type PromptOut } from "../api/bridgeClient";

/**
 * Prompt Engine (Fase 9, spec §9) — completamento della parte rimasta dopo "Prompt da
 * Immagine" (Fase 9 parziale, portata avanti in precedenza): scrittura manuale di un
 * prompt, traduzione IT→EN reale, blocco traduzione, negative prompt, cronologia.
 * Non ancora collegato a un workflow/generazione specifico — dipende dal Workflow
 * Builder completo (Fase 5), dichiarato esplicitamente.
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

  useEffect(loadProviders, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadHistory, []);

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

  async function handleDeleteHistoryEntry(id: string) {
    await bridgeClient.deletePrompt(id);
    loadHistory();
  }

  function handleReuse(prompt: PromptOut) {
    setTextIt(prompt.text_it ?? "");
    setTextEn(prompt.text_en);
    setNegativeTextEn(prompt.negative_text_en ?? "");
    setTranslationLocked(prompt.translation_locked);
  }

  return (
    <section aria-label="Prompt Engine">
      <h2>Prompt Engine</h2>
      <p className="settings-panel__hint">
        Scrivi un prompt e traducilo in inglese con il provider AI configurato. Non ancora collegato a un workflow
        specifico (arriva con il Workflow Builder completo, Fase 5) — qui è solo una cronologia di prompt riutilizzabili.
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
