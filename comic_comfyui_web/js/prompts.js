import { qs, qsa, el, toast, copyToClipboard, uid } from "./utils.js";
import { translateItToEn, optimizePrompt, tagify, DEFAULT_NEGATIVE_EN } from "./translate.js";
import { listCharacters, getCharacterById } from "./characters.js";
import { getActiveWorkflow } from "./workflows.js";
import { getConnectionSettings, getGenerationMode, getActiveProvider, getProviderSettings, onStateChange } from "./state.js";
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

// Quality/detail checkboxes and the aspect-ratio select, like the style
// select, carry their actual English prompt tag directly as the option/input
// value (see index.html) rather than a separate lookup table here.
function getQualityTags() {
  return qsa('#prompt-quality-options input[type="checkbox"]:checked').map((cb) => cb.value);
}

function setQualityTags(tags) {
  const wanted = new Set(tags || []);
  qsa('#prompt-quality-options input[type="checkbox"]').forEach((cb) => {
    cb.checked = wanted.has(cb.value);
  });
}

function getAspectRatioOption() {
  const select = qs("#prompt-aspect-ratio");
  const opt = select.options[select.selectedIndex];
  return {
    key: select.value,
    tag: opt?.dataset.tag || "",
    width: opt?.dataset.width ? Number(opt.dataset.width) : null,
    height: opt?.dataset.height ? Number(opt.dataset.height) : null,
  };
}

function saveDraft() {
  const draft = {
    sceneIt: qs("#prompt-input-it").value,
    negIt: qs("#prompt-input-neg-it").value,
    style: qs("#prompt-style").value,
    qualityTags: getQualityTags(),
    aspectRatio: qs("#prompt-aspect-ratio").value,
    characterIds: getSelectedCharacterIds(),
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

// `draft.characterId` (singular) is the pre-multi-slot shape; migrate it to
// a one-item array so old saved drafts/scenes still restore correctly.
function draftCharacterIds(draft) {
  if (Array.isArray(draft.characterIds)) return draft.characterIds;
  if (draft.characterId) return [draft.characterId];
  return [];
}

function restoreDraft() {
  const draft = loadDraft();
  if (!draft) return;
  qs("#prompt-input-it").value = draft.sceneIt || "";
  qs("#prompt-input-neg-it").value = draft.negIt || "";
  if (draft.style !== undefined) qs("#prompt-style").value = draft.style;
  if (draft.aspectRatio !== undefined) qs("#prompt-aspect-ratio").value = draft.aspectRatio;
  setQualityTags(draft.qualityTags);
  qs("#prompt-output-en").value = draft.outputEn || "";
  qs("#prompt-output-neg-en").value = draft.outputNegEn || "";
  lastSceneEn = draft.lastSceneEn ?? null;
  lastNegAdditionEn = draft.lastNegAdditionEn || "";

  setSelectedCharacterIds(draftCharacterIds(draft));
}

// --- Full prompt state (used by the saved-scenes archive) ---

export function getSceneDraftForSaving() {
  const characterIds = getSelectedCharacterIds();
  const characterNames = characterIds.map((id) => listCharacters().find((c) => c.id === id)?.name || "");
  return {
    sceneIt: qs("#prompt-input-it").value,
    negIt: qs("#prompt-input-neg-it").value,
    style: qs("#prompt-style").value,
    qualityTags: getQualityTags(),
    aspectRatio: qs("#prompt-aspect-ratio").value,
    characterIds,
    characterNames,
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
  if (draft.aspectRatio !== undefined) qs("#prompt-aspect-ratio").value = draft.aspectRatio;
  setQualityTags(draft.qualityTags);
  lastSceneEn = draft.lastSceneEn ?? null;
  lastNegAdditionEn = draft.lastNegAdditionEn || "";

  setSelectedCharacterIds(draftCharacterIds(draft));
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
  const qualityTags = getQualityTags();
  const aspectTag = getAspectRatioOption().tag;
  const extraTags = aspectTag ? [...directorTags, ...qualityTags, aspectTag] : [...directorTags, ...qualityTags];
  const positive = optimizePrompt(lastSceneEn, { style, extraTags });
  qs("#prompt-output-en").value = positive;
  lastGenerated.positive = positive;

  const negative = tagify(DEFAULT_NEGATIVE_EN, lastNegAdditionEn ? [lastNegAdditionEn] : []);
  qs("#prompt-output-neg-en").value = negative;
  lastGenerated.negative = negative;

  saveDraft();
}

// One reference-image "slot" per mapped LoadImage-type node in the active
// workflow, each independently assignable to a different character — this is
// what makes "3 characters together in one generation" possible, instead of
// broadcasting a single chosen character to every mapped node. In external-AI
// mode (or when the active workflow has no image mapping configured yet)
// there's exactly one generic slot, matching the old single-character UX.
let characterSlotLabels = ["Personaggio di riferimento"];

function computeCharacterSlots(workflow) {
  if (getGenerationMode() === "external") return ["Personaggio di riferimento"];
  const mapping = workflow?.mapping || {};
  const imageMappings = Array.isArray(mapping.images) ? mapping.images : mapping.image ? [mapping.image] : [];
  if (imageMappings.length === 0) return ["Personaggio di riferimento"];
  return imageMappings.map(
    (m, index) => m.label || workflow?.json?.[m.nodeId]?._meta?.title || `Immagine ${index + 1} (nodo #${m.nodeId})`
  );
}

function getSelectedCharacterIds() {
  return qsa("select[data-slot-index]", qs("#prompt-character-slots")).map((s) => s.value);
}

function setSelectedCharacterIds(ids) {
  qsa("select[data-slot-index]", qs("#prompt-character-slots")).forEach((select, index) => {
    const id = ids?.[index] || "";
    select.value = id && [...select.options].some((o) => o.value === id) ? id : "";
  });
  updateCharacterHint();
}

function updateCharacterHint() {
  const hint = qs("#prompt-character-hint");
  const ids = getSelectedCharacterIds();
  const chosen = ids
    .map((id, index) => ({ character: listCharacters().find((c) => c.id === id), label: characterSlotLabels[index] }))
    .filter((entry) => entry.character);

  if (chosen.length > 0) {
    const parts = chosen.map((entry) =>
      characterSlotLabels.length > 1 ? `${entry.label}: "${entry.character.name}"` : `"${entry.character.name}"`
    );
    hint.textContent = `✅ Userò ${parts.join(", ")} come riferimento: l'IA cercherà di mantenere lo stesso aspetto nell'immagine generata.`;
    hint.className = "status-box full ok";
  } else if (listCharacters().length > 0) {
    hint.textContent = "⚠️ Nessun personaggio selezionato: l'immagine generata non avrà un aspetto coerente con nessuno dei tuoi personaggi.";
    hint.className = "status-box full error";
  } else {
    hint.textContent = "Carica un personaggio nella scheda 'Personaggi' per mantenerne l'aspetto coerente nelle immagini generate.";
    hint.className = "status-box full";
  }
}

async function renderCharacterSlots() {
  const workflow = getGenerationMode() === "external" ? null : await getActiveWorkflow();
  characterSlotLabels = computeCharacterSlots(workflow);

  const container = qs("#prompt-character-slots");
  const previousValues = getSelectedCharacterIds();
  const isFirstRender = container.childElementCount === 0;
  container.innerHTML = "";

  characterSlotLabels.forEach((label, index) => {
    const select = el(
      "select",
      {
        "data-slot-index": String(index),
        onchange: () => {
          updateCharacterHint();
          saveDraft();
        },
      },
      [el("option", { value: "" }, "— nessuno —"), ...listCharacters().map((c) => el("option", { value: c.id }, c.name))]
    );
    const previous = previousValues[index];
    if (previous && [...select.options].some((o) => o.value === previous)) {
      select.value = previous;
    } else if (isFirstRender && index === 0 && !previous && listCharacters().length > 0) {
      // Nothing was explicitly chosen yet: default the first slot to the most
      // recently added character instead of silently generating with none.
      select.value = listCharacters()[0].id;
    }
    container.appendChild(el("label", { class: "full" }, [label, select]));
  });

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

  // Some workflows have several prompt-text nodes (e.g. custom nodes like
  // TextEncodeQwenImageEdit/TextEncodeQwenImageEditPlus alongside a regular
  // CLIPTextEncode, or multiple stages of the same node) that all need the
  // same prompt text — mapping.positives/negatives are arrays; the old
  // singular mapping.positive/negative is kept for workflows mapped before
  // multi-node support was added.
  const positiveMappings = Array.isArray(mapping.positives) ? mapping.positives : mapping.positive ? [mapping.positive] : [];
  for (const m of positiveMappings) {
    graph[m.nodeId].inputs[m.field] = positive;
  }
  const negativeMappings = Array.isArray(mapping.negatives) ? mapping.negatives : mapping.negative ? [mapping.negative] : [];
  for (const m of negativeMappings) {
    graph[m.nodeId].inputs[m.field] = negative;
  }
  if (mapping.seed) {
    graph[mapping.seed.nodeId].inputs[mapping.seed.field] = Math.floor(Math.random() * 1e15);
  }
  if (mapping.resolution) {
    const aspect = getAspectRatioOption();
    if (aspect.width && aspect.height) {
      graph[mapping.resolution.nodeId].inputs[mapping.resolution.widthField] = aspect.width;
      graph[mapping.resolution.nodeId].inputs[mapping.resolution.heightField] = aspect.height;
    }
  }

  // Some workflows have several LoadImage nodes that each need a DIFFERENT
  // reference image (e.g. up to 3 distinct characters combined in one
  // generation) — each entry in `mapping.images` corresponds 1:1, in order,
  // to a character slot rendered in "1. Personaggio" by renderCharacterSlots().
  // `mapping.image` (singular) is kept for workflows mapped before multi-node
  // support was added; it always pairs with a single slot.
  const imageMappings = Array.isArray(mapping.images) ? mapping.images : mapping.image ? [mapping.image] : [];
  const slotCharacterIds = getSelectedCharacterIds();
  if (imageMappings.length > 0 && slotCharacterIds.some(Boolean)) {
    setSendStatus("Caricamento immagini di riferimento su ComfyUI...");
    const uploadedByCharacterId = new Map();
    for (let index = 0; index < imageMappings.length; index++) {
      const characterId = slotCharacterIds[index];
      if (!characterId) continue; // slot left empty on purpose: leave that node's existing value untouched
      const imageMapping = imageMappings[index];
      let uploaded = uploadedByCharacterId.get(characterId);
      if (!uploaded) {
        const character = await getCharacterById(characterId);
        if (!character) continue;
        // Spaces/odd characters in the filename have caused ComfyUI's LoadImage
        // node to fail to find the file it was just given; a plain
        // alphanumeric name sidesteps any such filesystem/parsing ambiguity.
        const safeName = `char-${character.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}.png`;
        const result = await client.uploadImage(character.blob, safeName);
        uploaded = result.subfolder ? `${result.subfolder}/${result.name}` : result.name;
        uploadedByCharacterId.set(characterId, uploaded);
      }
      graph[imageMapping.nodeId].inputs[imageMapping.field] = uploaded;
    }
  }

  setSendStatus("Invio del workflow a ComfyUI...");
  const queued = await client.queuePrompt(graph, sessionClientId);
  if (queued.node_errors && Object.keys(queued.node_errors).length > 0) {
    throw new ComfyUIError(`Errori nei nodi del workflow: ${JSON.stringify(queued.node_errors)}`);
  }

  setSendStatus("Generazione in corso su ComfyUI, attendere...");
  // Server-side progress events aren't guaranteed on every ComfyUI setup (they
  // can arrive late, not at all for some node types, or get lost if the socket
  // reconnects) — a local elapsed-time tick keeps the status visibly moving
  // even with no percentage yet, so a slow/complex generation doesn't look
  // stuck when it's actually still running.
  const genStartedAt = Date.now();
  let lastProgress = null;
  const tickTimer = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - genStartedAt) / 1000);
    const elapsed = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
    if (lastProgress && lastProgress.max > 0) {
      const pct = Math.round((lastProgress.value / lastProgress.max) * 100);
      setSendStatus(`Generazione in corso su ComfyUI... ${pct}% (passo ${lastProgress.value}/${lastProgress.max}) · ${elapsed}`);
    } else {
      setSendStatus(`Generazione in corso su ComfyUI... ${elapsed} (i workflow complessi possono richiedere diversi minuti)`);
    }
  }, 1000);

  let images;
  try {
    images = await client.waitForResult(queued.prompt_id, sessionClientId, {
      timeoutMs: 20 * 60 * 1000,
      onProgress: (p) => {
        lastProgress = p;
      },
    });
  } finally {
    clearInterval(tickTimer);
  }

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
  // External providers only support one reference image, and external mode
  // always renders exactly one character slot (see computeCharacterSlots).
  const characterId = getSelectedCharacterIds()[0];
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

export async function initPrompts() {
  await renderCharacterSlots();
  restoreDraft();
  const negField = qs("#prompt-output-neg-en");
  if (!negField.value.trim()) negField.value = DEFAULT_NEGATIVE_EN;
  window.addEventListener("characters-updated", renderCharacterSlots);
  // Any of these can change how many reference-image slots should exist (a
  // different workflow has a different number of mapped LoadImage nodes, its
  // mapping was just edited, or switching to external-AI mode collapses back
  // to a single generic slot). "active-workflow-updated" is state.js's own
  // pub/sub (not a window event), so it's wired through onStateChange.
  onStateChange((event) => {
    if (event === "active-workflow-updated") renderCharacterSlots();
  });
  window.addEventListener("workflow-mapping-updated", renderCharacterSlots);
  window.addEventListener("generation-mode-ui-updated", renderCharacterSlots);
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
  qs("#prompt-input-it").addEventListener("input", saveDraft);
  qs("#prompt-input-neg-it").addEventListener("input", saveDraft);
  qs("#prompt-style").addEventListener("change", rebuildOutputs);
  qs("#prompt-aspect-ratio").addEventListener("change", rebuildOutputs);
  qsa('#prompt-quality-options input[type="checkbox"]').forEach((cb) => cb.addEventListener("change", rebuildOutputs));
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
