import { qs, el, toast, copyToClipboard, uid } from "./utils.js";
import { translateItToEn, optimizePrompt, tagify, DEFAULT_NEGATIVE_EN } from "./translate.js";
import { listCharacters, getCharacterById } from "./characters.js";
import { getActiveWorkflow } from "./workflows.js";
import { getConnectionSettings, getGenerationMode, getActiveProvider, getProviderSettings } from "./state.js";
import { ComfyUIClient, ComfyUIError } from "./comfyui.js";
import { addArchiveImage, refreshArchive } from "./archive.js";
import { getAppliedDirectorTags } from "./director.js";
import { generateImageExternal, getProviderMeta, ProviderError } from "./providers.js";
import { initVoiceDictation } from "./voice.js";

const sessionClientId = uid();
const DRAFT_KEY = "comic-studio:prompt-draft";
let lastGenerated = { positive: "", negative: "" };

// Raw translated text (before style/quality/director tags get layered on),
// kept separately so the displayed prompt can be rebuilt instantly whenever
// the style or Director's Mode selection changes, without re-calling the
// translation API and without requiring the user to remember to press
// "Traduci & Ottimizza" again after tweaking the camera.
let lastSceneEn = null;
let lastNegAdditionEn = "";

function saveDraft() {
  const draft = {
    sceneIt: qs("#prompt-input-it").value,
    negIt: qs("#prompt-input-neg-it").value,
    style: qs("#prompt-style").value,
    characterId: qs("#prompt-character-select").value,
    outputEn: qs("#prompt-output-en").value,
    outputNegEn: qs("#prompt-output-neg-en").value,
    lastSceneEn,
    lastNegAdditionEn,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function restoreDraft() {
  const draft = loadDraft();
  if (!draft) return;
  qs("#prompt-input-it").value = draft.sceneIt || "";
  qs("#prompt-input-neg-it").value = draft.negIt || "";
  if (draft.style !== undefined) qs("#prompt-style").value = draft.style;
  qs("#prompt-output-en").value = draft.outputEn || "";
  qs("#prompt-output-neg-en").value = draft.outputNegEn || "";
  lastSceneEn = draft.lastSceneEn ?? null;
  lastNegAdditionEn = draft.lastNegAdditionEn || "";

  const select = qs("#prompt-character-select");
  if (draft.characterId && [...select.options].some((o) => o.value === draft.characterId)) {
    select.value = draft.characterId;
  }
  updateCharacterHint();
}

// --- Full prompt state (used by the saved-scenes archive) ---

export function getSceneDraftForSaving() {
  const select = qs("#prompt-character-select");
  return {
    sceneIt: qs("#prompt-input-it").value,
    negIt: qs("#prompt-input-neg-it").value,
    style: qs("#prompt-style").value,
    characterId: select.value,
    characterName: select.value ? select.options[select.selectedIndex]?.text : "",
    outputEn: qs("#prompt-output-en").value,
    outputNegEn: qs("#prompt-output-neg-en").value,
    lastSceneEn,
    lastNegAdditionEn,
  };
}

export function applySceneDraft(draft) {
  qs("#prompt-input-it").value = draft.sceneIt || "";
  qs("#prompt-input-neg-it").value = draft.negIt || "";
  if (draft.style !== undefined) qs("#prompt-style").value = draft.style;
  lastSceneEn = draft.lastSceneEn ?? null;
  lastNegAdditionEn = draft.lastNegAdditionEn || "";

  const select = qs("#prompt-character-select");
  if (draft.characterId && [...select.options].some((o) => o.value === draft.characterId)) {
    select.value = draft.characterId;
  } else {
    select.value = "";
  }
  updateCharacterHint();
  rebuildOutputs();
  saveDraft();
}

/**
 * Recomputes the displayed positive/negative prompt from the last translated
 * text plus the CURRENT style and Director's Mode tags. Safe to call often
 * (style change, director tag change, right before sending) since it does
 * no network requests. No-op until a translation has happened at least once.
 */
function rebuildOutputs() {
  if (lastSceneEn === null) return;
  const style = qs("#prompt-style").value;
  const directorTags = getAppliedDirectorTags();
  const positive = optimizePrompt(lastSceneEn, { style, extraTags: directorTags });
  qs("#prompt-output-en").value = positive;
  lastGenerated.positive = positive;

  const negative = tagify(DEFAULT_NEGATIVE_EN, lastNegAdditionEn ? [lastNegAdditionEn] : []);
  qs("#prompt-output-neg-en").value = negative;
  lastGenerated.negative = negative;

  saveDraft();
}

function updateCharacterHint() {
  const select = qs("#prompt-character-select");
  const hint = qs("#prompt-character-hint");
  const selected = listCharacters().find((c) => c.id === select.value);
  if (selected) {
    hint.textContent = `✅ Userò "${selected.name}" come riferimento: l'IA cercherà di mantenere lo stesso aspetto del personaggio nell'immagine generata.`;
    hint.className = "status-box full ok";
  } else if (listCharacters().length > 0) {
    hint.textContent = "⚠️ Nessun personaggio selezionato: l'immagine generata non avrà un aspetto coerente con nessuno dei tuoi personaggi.";
    hint.className = "status-box full error";
  } else {
    hint.textContent = "Carica un personaggio nella scheda 'Personaggi' per mantenerne l'aspetto coerente nelle immagini generate.";
    hint.className = "status-box full";
  }
}

function refreshCharacterSelect() {
  const select = qs("#prompt-character-select");
  const current = select.value;
  select.innerHTML = "";
  select.appendChild(el("option", { value: "" }, "— nessuno —"));
  for (const character of listCharacters()) {
    select.appendChild(el("option", { value: character.id }, character.name));
  }
  const stillExists = [...select.options].some((o) => o.value === current);
  if (stillExists && current) {
    select.value = current;
  } else if (!current && listCharacters().length > 0) {
    // Nothing was explicitly chosen yet: default to the most recently added character
    // instead of silently generating with no reference image.
    select.value = listCharacters()[0].id;
  }
  updateCharacterHint();
}

function setSendStatus(message, type = "") {
  const box = qs("#prompt-send-status");
  box.textContent = message;
  box.className = `status-box${type ? " " + type : ""}`;
}

async function handleTranslate() {
  const sceneIt = qs("#prompt-input-it").value.trim();
  const negIt = qs("#prompt-input-neg-it").value.trim();

  if (!sceneIt) {
    toast("Inserisci prima una descrizione della scena.", "error");
    return;
  }

  const btn = qs("#prompt-translate-btn");
  btn.disabled = true;
  btn.textContent = "Traduzione in corso...";

  try {
    const { text: sceneEn, source } = await translateItToEn(sceneIt);
    lastSceneEn = sceneEn;
    lastNegAdditionEn = negIt ? (await translateItToEn(negIt)).text : "";
    rebuildOutputs();

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

function updateCopyOpenButton() {
  const meta = getProviderMeta(getActiveProvider());
  qs("#prompt-copy-open-btn").textContent = `📋🔗 Copia prompt e apri ${meta?.label || "IA"}`;
}

async function handleCopyAndOpen() {
  const positive = qs("#prompt-output-en").value.trim();
  if (!positive) {
    toast("Genera prima il prompt (Traduci & Ottimizza).", "error");
    return;
  }
  const negative = qs("#prompt-output-neg-en").value.trim();
  const combined = negative ? `${positive}\n\nDa evitare: ${negative}` : positive;

  const meta = getProviderMeta(getActiveProvider());
  const ok = await copyToClipboard(combined);
  if (!ok) {
    toast("Copia non riuscita.", "error");
    return;
  }
  if (meta?.consumerAppUrl) window.open(meta.consumerAppUrl, "_blank", "noopener");
  toast(`Prompt copiato. Ho aperto ${meta?.label || "l'IA"}: incolla il testo, poi l'immagine del personaggio.`, "success");
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
      // Spaces/odd characters in the filename have caused ComfyUI's LoadImage
      // node to fail to find the file it was just given; a plain
      // alphanumeric name sidesteps any such filesystem/parsing ambiguity.
      const safeName = `char-${character.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}.png`;
      const uploaded = await client.uploadImage(character.blob, safeName);
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
  const images = await client.waitForResult(queued.prompt_id, sessionClientId, {
    onProgress: ({ value, max }) => {
      if (max > 0) {
        const pct = Math.round((value / max) * 100);
        setSendStatus(`Generazione in corso su ComfyUI... ${pct}% (passo ${value}/${max})`);
      }
    },
  });

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
  qs("#prompt-view-archive-btn").hidden = false;
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
  qs("#prompt-view-archive-btn").hidden = false;
}

async function handleSend() {
  rebuildOutputs(); // safety net: pick up any camera/style change even if the user didn't re-translate
  const positive = qs("#prompt-output-en").value.trim();
  if (!positive) {
    toast("Genera prima il prompt (Traduci & Ottimizza).", "error");
    return;
  }
  const negative = qs("#prompt-output-neg-en").value.trim();

  const sendBtn = qs("#prompt-send-btn");
  sendBtn.disabled = true;
  qs("#prompt-view-archive-btn").hidden = true;
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
  updateCopyOpenButton();
}

export function initPrompts() {
  refreshCharacterSelect();
  restoreDraft();
  const negField = qs("#prompt-output-neg-en");
  if (!negField.value.trim()) negField.value = DEFAULT_NEGATIVE_EN;
  window.addEventListener("characters-updated", refreshCharacterSelect);
  window.addEventListener("generation-mode-ui-updated", updateModeIndicator);
  window.addEventListener("storage", updateModeIndicator);
  updateModeIndicator();

  qs("#prompt-translate-btn").addEventListener("click", handleTranslate);
  qs("#prompt-copy-btn").addEventListener("click", () => handleCopy("prompt-output-en", "Prompt"));
  qs("#prompt-copy-neg-btn").addEventListener("click", () => handleCopy("prompt-output-neg-en", "Prompt negativo"));
  qs("#prompt-send-btn").addEventListener("click", handleSend);
  qs("#prompt-view-archive-btn").addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("request-tab", { detail: "tab-archive" }));
  });
  qs("#prompt-copy-open-btn").addEventListener("click", handleCopyAndOpen);
  qs("#prompt-character-select").addEventListener("change", () => {
    updateCharacterHint();
    saveDraft();
  });
  qs("#prompt-input-it").addEventListener("input", saveDraft);
  qs("#prompt-input-neg-it").addEventListener("input", saveDraft);
  qs("#prompt-style").addEventListener("change", rebuildOutputs);
  window.addEventListener("director-tags-updated", rebuildOutputs);

  initVoiceDictation("prompt-input-it", "prompt-input-it-mic");
  initVoiceDictation("prompt-input-neg-it", "prompt-input-neg-it-mic");

  // Re-check indicator whenever the user switches to the Prompt tab or changes active provider.
  document.querySelectorAll('.tab-btn[data-tab="tab-prompt"]').forEach((btn) =>
    btn.addEventListener("click", updateModeIndicator)
  );
  document.querySelectorAll('input[name="active-provider"]').forEach((radio) =>
    radio.addEventListener("change", updateModeIndicator)
  );
}
