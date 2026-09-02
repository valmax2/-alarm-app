import { useEffect, useRef, useState } from "react";

import { bridgeClient, type AIProviderOut, type ChatMessageOut } from "../api/bridgeClient";

/**
 * Assistente AI (Fase 10 v1, spec §21) — SOLO conversazione testuale reale con il
 * provider AI configurato dall'utente (stessa astrazione della Fase 9). L'AI Tool
 * Layer completo (l'assistente che legge/modifica il workflow con preview/applica/
 * annulla) NON è ancora implementato: dichiarato qui esplicitamente, mai finto.
 */
export function ChatPanel() {
  const [providers, setProviders] = useState<AIProviderOut[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessageOut[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  function loadMessages() {
    bridgeClient
      .listChatMessages()
      .then(setMessages)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(loadProviders, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadMessages, []);

  useEffect(() => {
    // `scrollTo` non è implementato in jsdom (ambiente di test) — guardia difensiva,
    // nessun effetto sul comportamento reale nel browser.
    if (typeof listRef.current?.scrollTo === "function") {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [messages]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedProviderId || sending) return;
    setSending(true);
    setError(null);
    try {
      const newMessages = await bridgeClient.sendChatMessage(text, selectedProviderId);
      setMessages((prev) => [...prev, ...newMessages]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      loadMessages(); // il messaggio utente potrebbe comunque essere stato salvato lato Bridge
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    await bridgeClient.clearChatMessages();
    setMessages([]);
  }

  return (
    <section aria-label="Assistente AI" className="chat-panel">
      <h2>Assistente AI</h2>
      <p className="settings-panel__hint">
        Chat reale con il provider AI configurato (stesso di "Prompt da Immagine"). Non può ancora leggere o modificare il
        tuo workflow — solo conversazione testuale, arriva con un aggiornamento futuro.
      </p>

      {providersError && (
        <p role="alert" className="settings-panel__feedback--error">
          {providersError}
        </p>
      )}
      {providers.length === 0 && !providersError && (
        <p>Nessun provider configurato. Aggiungine uno nel pannello "Prompt da Immagine" per poter chattare.</p>
      )}
      {providers.length > 0 && (
        <>
          <label htmlFor="chat-provider">Provider</label>
          <select id="chat-provider" value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </>
      )}

      <div ref={listRef} className="chat-panel__messages" aria-label="Cronologia messaggi">
        {messages.length === 0 && <p className="settings-panel__hint">Nessun messaggio ancora.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-panel__message chat-panel__message--${m.role}`}>
            <span className="chat-panel__message-role">{m.role === "user" ? "Tu" : "Assistente"}</span>
            <p>{m.text}</p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="settings-panel__feedback--error">
          {error}
        </p>
      )}

      <form onSubmit={handleSend} className="chat-panel__form">
        <label htmlFor="chat-draft">Messaggio</label>
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          disabled={!selectedProviderId || sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend(e);
            }
          }}
        />
        <button type="submit" disabled={!selectedProviderId || !draft.trim() || sending}>
          {sending ? "Invio…" : "Invia"}
        </button>
      </form>

      {messages.length > 0 && (
        <button type="button" onClick={() => void handleClear()}>
          Svuota cronologia
        </button>
      )}
    </section>
  );
}
