import { useEffect, useState } from "react";

import {
  bridgeClient,
  type CharacterDetailOut,
  type CharacterSummaryOut,
  type GraphNode,
  type SendImageToWorkflowResponse,
  type WorkflowSummaryOut,
} from "../api/bridgeClient";

/**
 * Libreria Personaggi (Fase 7, spec §7/§17).
 *
 * "Invia al workflow" (chiude il divario "nessun collegamento alla generazione"
 * dichiarato in precedenza): l'utente sceglie ESPLICITAMENTE workflow e nodo target
 * — vedi `bridge/workflow/image_targets.py` per il perché non viene individuato in
 * automatico. Resta dichiarato esplicitamente, mai finto: nessuna proposta
 * automatica di "workflow adatto a questo personaggio" (dipende dal Workflow
 * Intelligence Engine completo, Fase 5, non ancora costruito).
 */
export function CharactersPanel() {
  const [characters, setCharacters] = useState<CharacterSummaryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CharacterDetailOut | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [workflows, setWorkflows] = useState<WorkflowSummaryOut[]>([]);
  const [sendTargetImageId, setSendTargetImageId] = useState<string | null>(null);
  const [sendWorkflowId, setSendWorkflowId] = useState("");
  const [sendNodes, setSendNodes] = useState<GraphNode[]>([]);
  const [sendNodeId, setSendNodeId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendImageToWorkflowResponse | null>(null);

  function refreshList() {
    bridgeClient
      .listCharacters()
      .then((list) => {
        setCharacters(list);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  function refreshDetail(id: string) {
    bridgeClient
      .getCharacter(id)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(refreshList, []);
  useEffect(() => {
    if (selectedId) refreshDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);
  useEffect(() => {
    bridgeClient
      .listWorkflows()
      .then((list) => {
        if (Array.isArray(list)) setWorkflows(list);
      })
      .catch(() => undefined);
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    const created = await bridgeClient.createCharacter({ name: newName.trim() });
    setNewName("");
    refreshList();
    setSelectedId(created.id);
  }

  async function handleDelete(id: string) {
    await bridgeClient.deleteCharacter(id);
    if (selectedId === id) setSelectedId(null);
    refreshList();
  }

  async function handleTogglePrivate() {
    if (!detail) return;
    await bridgeClient.updateCharacter(detail.id, { is_private: !detail.is_private });
    refreshDetail(detail.id);
    refreshList();
  }

  async function handleUploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !detail) return;
    setUploadError(null);
    try {
      await bridgeClient.uploadCharacterImage(detail.id, file, detail.images.length === 0 ? "main" : "reference");
      refreshDetail(detail.id);
      refreshList();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!detail) return;
    await bridgeClient.deleteCharacterImage(detail.id, imageId);
    refreshDetail(detail.id);
    refreshList();
  }

  async function handleToggleImageHidden(imageId: string, currentlyHidden: boolean) {
    if (!detail) return;
    await bridgeClient.updateCharacterImage(detail.id, imageId, { is_hidden: !currentlyHidden });
    refreshDetail(detail.id);
  }

  function handleOpenSend(imageId: string) {
    setSendTargetImageId((current) => (current === imageId ? null : imageId));
    setSendError(null);
    setSendResult(null);
    setSendNodeId("");
    setSendNodes([]);
    if (workflows.length > 0) {
      const firstWorkflowId = workflows[0].id;
      setSendWorkflowId(firstWorkflowId);
      void loadNodesForWorkflow(firstWorkflowId);
    } else {
      setSendWorkflowId("");
    }
  }

  async function loadNodesForWorkflow(workflowId: string) {
    if (!workflowId) {
      setSendNodes([]);
      return;
    }
    try {
      const wf = await bridgeClient.getWorkflow(workflowId);
      setSendNodes(wf.graph.nodes);
    } catch {
      setSendNodes([]);
    }
  }

  async function handleSendToWorkflow(imageId: string) {
    if (!detail || !sendWorkflowId || !sendNodeId) return;
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const result = await bridgeClient.sendCharacterImageToWorkflow(detail.id, imageId, sendWorkflowId, sendNodeId);
      setSendResult(result);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleImportPack(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      const imported = await bridgeClient.importCharacterPack(file);
      refreshList();
      setSelectedId(imported.id);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  if (detail) {
    return (
      <section aria-label="Dettaglio personaggio">
        <button type="button" onClick={() => setSelectedId(null)}>
          ← Torna alla libreria
        </button>
        <h2>{detail.name}</h2>
        <a href={bridgeClient.characterExportUrl(detail.id)} download>
          Esporta Character Pack (.zip)
        </a>
        <label>
          <input type="checkbox" checked={detail.is_private} onChange={() => void handleTogglePrivate()} /> Privato
          (offusca l'anteprima in UI)
        </label>
        <p className="settings-panel__hint">
          {detail.is_private
            ? "Personaggio privato: le anteprime restano offuscate finché non lo riapri qui."
            : "Personaggio pubblico: anteprime visibili."}
        </p>

        <h3>Immagini</h3>
        <input type="file" accept="image/*" aria-label="Carica immagine personaggio" onChange={(e) => void handleUploadImage(e)} />
        {uploadError && (
          <p role="alert" className="settings-panel__feedback--error">
            {uploadError}
          </p>
        )}

        <ul className="models-panel__list characters-panel__image-list">
          {detail.images.map((img) => (
            <li key={img.id} className="models-panel__item characters-panel__image-item">
              <img
                src={bridgeClient.characterImageUrl(detail.id, img.id)}
                alt={`${detail.name} — ${img.role}`}
                className={`characters-panel__thumb${detail.is_private || img.is_hidden ? " characters-panel__thumb--blurred" : ""}`}
              />
              <span className="models-panel__meta">
                {img.role === "main" ? "Principale" : "Riferimento"}
                {img.id === detail.main_image_id ? " · copertina" : ""}
                {img.is_hidden ? " · nascosta" : ""}
              </span>
              <button type="button" onClick={() => void handleToggleImageHidden(img.id, img.is_hidden)}>
                {img.is_hidden ? "Mostra" : "Nascondi"}
              </button>
              <button type="button" onClick={() => handleOpenSend(img.id)} disabled={workflows.length === 0}>
                Invia al workflow
              </button>
              <button type="button" onClick={() => void handleDeleteImage(img.id)}>
                Elimina
              </button>

              {sendTargetImageId === img.id && (
                <div className="characters-panel__send-to-workflow">
                  <label htmlFor="send-workflow-select">Workflow di destinazione</label>
                  <select
                    id="send-workflow-select" value={sendWorkflowId}
                    onChange={(e) => {
                      setSendWorkflowId(e.target.value);
                      setSendNodeId("");
                      void loadNodesForWorkflow(e.target.value);
                    }}
                  >
                    {workflows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="send-node-select">Nodo target</label>
                  <select id="send-node-select" value={sendNodeId} onChange={(e) => setSendNodeId(e.target.value)}>
                    <option value="">Scegli un nodo…</option>
                    {sendNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.class_type} ({n.id})
                      </option>
                    ))}
                  </select>
                  {sendNodes.length === 0 && sendWorkflowId && (
                    <p className="settings-panel__hint">Questo workflow non ha ancora nodi — apri prima il pannello Workflow.</p>
                  )}

                  <button type="button" onClick={() => void handleSendToWorkflow(img.id)} disabled={!sendNodeId || sending}>
                    {sending ? "Invio…" : "Invia"}
                  </button>
                  <p className="settings-panel__note">
                    Carica davvero l'immagine su ComfyUI e la scrive nell'unico campo "immagine da caricare" di quel
                    nodo — se il nodo scelto non ne ha uno solo, l'errore reale spiega perché.
                  </p>
                  {sendError && (
                    <p role="alert" className="settings-panel__feedback--error">
                      {sendError}
                    </p>
                  )}
                  {sendResult && (
                    <p className="settings-panel__feedback">
                      Immagine caricata su ComfyUI come "{sendResult.uploaded_filename}" e scritta nel nodo{" "}
                      {sendResult.class_type} ({sendResult.node_id}) — nuova versione {sendResult.version_number} del
                      workflow.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
          {detail.images.length === 0 && <p>Nessuna immagine ancora caricata.</p>}
        </ul>
      </section>
    );
  }

  return (
    <section aria-label="Personaggi">
      <h2>Personaggi</h2>
      <p className="settings-panel__hint">
        Libreria dati e immagini — apri un personaggio per inviare le sue immagini a un nodo di un workflow aperto.
        Esporta/importa un personaggio come Character Pack (.zip) per condividerlo o farne il backup.
      </p>

      <form onSubmit={handleCreate}>
        <label htmlFor="new-character-name">Nuovo personaggio</label>
        <input id="new-character-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" disabled={!newName.trim()}>
          Crea
        </button>
      </form>

      <label htmlFor="import-character-pack">Oppure importa un Character Pack (.zip)</label>
      <input
        id="import-character-pack"
        type="file"
        accept=".zip,application/zip"
        disabled={importing}
        onChange={(e) => void handleImportPack(e)}
      />
      {importError && (
        <p role="alert" className="settings-panel__feedback--error">
          {importError}
        </p>
      )}

      {error && (
        <p role="alert" className="settings-panel__feedback--error">
          {error}
        </p>
      )}

      <ul className="models-panel__list">
        {(characters ?? []).map((c) => (
          <li key={c.id} className="models-panel__item">
            <span className="models-panel__name">
              {c.name}
              {c.is_private ? " 🔒" : ""}
            </span>
            <span className="models-panel__meta">
              {c.image_count} immagini{c.tags.length > 0 ? ` · ${c.tags.join(", ")}` : ""}
            </span>
            <button type="button" onClick={() => setSelectedId(c.id)}>
              Apri
            </button>
            <button type="button" onClick={() => void handleDelete(c.id)}>
              Elimina
            </button>
          </li>
        ))}
        {characters && characters.length === 0 && <p>Nessun personaggio ancora creato.</p>}
      </ul>
    </section>
  );
}
