import { qs, el, toast, copyToClipboard, uid } from "./utils.js";
import { translateItToEn, optimizePrompt } from "./translate.js";
import { listCharacters, getCharacterById } from "./characters.js";
import { getActiveWorkflow } from "./workflows.js";
import { getConnectionSettings, getGenerationMode, getActiveProvider, getProviderSettings } from "./state.js";
import { ComfyUIClient, ComfyUIError } from "./comfyui.js";
import { addArchiveImage, refreshArchive } from "./archive.js";
import { getAppliedDirectorTags } from "./director.js";
import { generateImageExternal, getProviderMeta, ProviderError } from "./providers.js";

const sessionClientId = uid();
let lastGenerated = { positive: "", negative: "" };

function refreshCharacterSelect() {
  const select = qs("#prompt-character-select");
  const current = select.value;
  select.innerHTML = "";
  select.appendChild(el("option", { value: "" }, "— nessuno —"));
  for (const character of listCharacters()) {
    select.appendChild(el("option", { value: character.id }, character.name));
  }
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function setSendStatus(message, type = "") {
  const box = qs("#prompt-send-status");
  box.textContent = message;
  box.className = `status-box${type ? " " + type : ""}`;
}

async function handleTranslate() {
  const sceneIt = qs("#prompt-input-it").value.trim();
  const negIt = qs("#prompt-input-neg-it").value.trim();
  const style = qs("#prompt-style").value;

  if (!sceneIt) {
    toast("Inserisci prima una descrizione della scena.", "error");
    return;
  }

  const btn = qs("#prompt-translate-btn");
  btn.disabled = true;
  btn.textContent = "Traduzione in corso...";

  try {
    const { text: sceneEn, source } = await translateItToEn(sceneIt);
    const directorTags = getAppliedDirectorTags();
    const positive = optimizePrompt(sceneEn, { style, extraTags: directorTags });
    qs("#prompt-output-en").value = positive;
    lastGenerated.positive = positive;

    if (negIt) {
      const { text: negEn } = await translateItToEn(negIt);
      const negative = optimizePrompt(negEn, { style: "", extraTags: [] });
      qs("#prompt-output-neg-en").value = negative;
      lastGenerated.negative = negative;
    } else {
      qs("#prompt-output-neg-en").value = "";
      lastGenerated.negative = "";
    }

    toast(
      source === "api" ? "Prompt tradotto e ottimizzato." : "Tradotto con dizionario locale (API non raggiungibile).",
      source === "api" ? "success" : "info"
    );
  } catch (err) {
    toast(`Errore durante la traduzione: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Traduci & Ottimizza";
  }
}

async function handleCopy(sourceId, label) {
  const value = qs(`#${sourceId}`).value;
  if (!value) {
    toast(`Nessun ${label} da copiare.`, "error");
    return;
  }
  const ok = await copyToClipboard(value);
  toast(ok ? `${label} copiato negli appunti.` : "Copia non riuscita.", ok ? "success" : "error");
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function handleSendLocal(positive, negative) {
  const settings = getConnectionSettings();
  if (!settings) {
    setSendStatus("Configura prima la connessione a ComfyUI nella scheda 'Connessione ComfyUI'.", "error");
    return;
  }

  const workflow = await getActiveWorkflow();
  if (!workflow) {
    setSendStatus("Seleziona un workflow attivo nella scheda 'Workflow'.", "error");
    return;
  }

  const client = new ComfyUIClient(settings);
  const graph = deepClone(workflow.json);
  const mapping = workflow.mapping || {};

  if (mapping.positive) {
    graph[mapping.positive.nodeId].inputs[mapping.positive.field] = positive;
  }
  if (mapping.negative) {
    graph[mapping.negative.nodeId].inputs[mapping.negative.field] = negative;
  }
  if (mapping.seed) {
    graph[mapping.seed.nodeId].inputs[mapping.seed.field] = Math.floor(Math.random() * 1e15);
  }

  const characterId = qs("#prompt-character-select").value;
  if (mapping.image && characterId) {
    const character = await getCharacterById(characterId);
    if (character) {
      setSendStatus("Caricamento immagine di riferimento su ComfyUI...");
      const uploaded = await client.uploadImage(character.blob, `${character.name}.png`);
      graph[mapping.image.nodeId].inputs[mapping.image.field] = uploaded.subfolder
        ? `${uploaded.subfolder}/${uploaded.name}`
        : uploaded.name;
    }
  }

  setSendStatus("Invio del workflow a ComfyUI...");
  const queued = await client.queuePrompt(graph, sessionClientId);
  if (queued.node_errors && Object.keys(queued.node_errors).length > 0) {
    throw new ComfyUIError(`Errori nei nodi del workflow: ${JSON.stringify(queued.node_errors)}`);
  }

  setSendStatus("Generazione in corso su ComfyUI, attendere...");
  const images = await client.waitForResult(queued.prompt_id);

  if (images.length === 0) {
    setSendStatus("Generazione completata ma nessuna immagine restituita.", "error");
    return;
  }

  for (const imageRef of images) {
    const blob = await client.fetchImageBlob(imageRef);
    await addArchiveImage(blob, { name: imageRef.filename.replace(/\.[^/.]+$/, ""), prompt: positive, workflowName: workflow.name });
  }
  refreshArchive();
  setSendStatus(`✅ ${images.length} immagine/i generate e salvate in archivio (ComfyUI).`, "ok");
  toast("Generazione completata.", "success");
}

async function handleSendExternal(positive, negative) {
  const providerId = getActiveProvider();
  const meta = getProviderMeta(providerId);
  const settings = getProviderSettings(providerId);
  if (!settings?.apiKey) {
    setSendStatus(`Inserisci la API key di ${meta?.label || providerId} nella scheda 'IA Esterne'.`, "error");
    return;
  }

  let referenceBlob = null;
  const characterId = qs("#prompt-character-select").value;
  if (characterId) {
    if (!meta?.supportsReferenceImage) {
      setSendStatus(`${meta?.label || providerId} non supporta ancora l'immagine di riferimento: genero solo da testo.`, "");
    } else {
      const character = await getCharacterById(characterId);
      referenceBlob = character?.blob || null;
    }
  }

  setSendStatus(`Generazione in corso con ${meta?.label || providerId}, attendere...`);
  const blobs = await generateImageExternal({ provider: providerId, settings, positive, negative, referenceBlob });

  for (const blob of blobs) {
    await addArchiveImage(blob, { name: `${providerId}-${Date.now()}`, prompt: positive, workflowName: `IA esterna: ${meta?.label || providerId}` });
  }
  refreshArchive();
  setSendStatus(`✅ ${blobs.length} immagine/i generate e salvate in archivio (${meta?.label || providerId}).`, "ok");
  toast("Generazione completata.", "success");
}

async function handleSend() {
  const positive = qs("#prompt-output-en").value.trim();
  if (!positive) {
    toast("Genera prima il prompt (Traduci & Ottimizza).", "error");
    return;
  }
  const negative = qs("#prompt-output-neg-en").value.trim();

  const sendBtn = qs("#prompt-send-btn");
  sendBtn.disabled = true;
  setSendStatus("Preparazione della richiesta...");

  try {
    if (getGenerationMode() === "external") {
      await handleSendExternal(positive, negative);
    } else {
      await handleSendLocal(positive, negative);
    }
  } catch (err) {
    const message = err instanceof ComfyUIError || err instanceof ProviderError ? err.message : `Errore imprevisto: ${err.message}`;
    setSendStatus(message, "error");
    toast(message, "error");
  } finally {
    sendBtn.disabled = false;
  }
}

function updateModeIndicator() {
  const mode = getGenerationMode();
  const indicator = qs("#prompt-mode-indicator");
  const sendBtn = qs("#prompt-send-btn");
  if (mode === "external") {
    const meta = getProviderMeta(getActiveProvider());
    indicator.textContent = `☁️ Modalità IA Esterna — provider attivo: ${meta?.label || "nessuno selezionato"} (configuralo nella scheda 'IA Esterne').`;
    sendBtn.textContent = `🚀 Genera con ${meta?.label || "IA esterna"}`;
  } else {
    indicator.textContent = "🖥️ Modalità ComfyUI locale — usa il workflow attivo configurato nella scheda 'Workflow'.";
    sendBtn.textContent = "🚀 Invia a ComfyUI";
  }
}

export function initPrompts() {
  refreshCharacterSelect();
  window.addEventListener("characters-updated", refreshCharacterSelect);
  window.addEventListener("generation-mode-ui-updated", updateModeIndicator);
  window.addEventListener("storage", updateModeIndicator);
  updateModeIndicator();

  qs("#prompt-translate-btn").addEventListener("click", handleTranslate);
  qs("#prompt-copy-btn").addEventListener("click", () => handleCopy("prompt-output-en", "Prompt"));
  qs("#prompt-copy-neg-btn").addEventListener("click", () => handleCopy("prompt-output-neg-en", "Prompt negativo"));
  qs("#prompt-send-btn").addEventListener("click", handleSend);

  // Re-check indicator whenever the user switches to the Prompt tab or changes active provider.
  document.querySelectorAll('.tab-btn[data-tab="tab-prompt"]').forEach((btn) =>
    btn.addEventListener("click", updateModeIndicator)
  );
  document.querySelectorAll('input[name="active-provider"]').forEach((radio) =>
    radio.addEventListener("change", updateModeIndicator)
  );
}
