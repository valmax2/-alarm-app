// ==========================================================================
// modules/promptBuilder.js — MODULO 1: CREA PERSONAGGIO / PROMPT
//
// 8 steps, one screen each, always showing where the user is and what's
// next. No ComfyUI-technical concepts appear here (per the core UX rule).
// ==========================================================================

import {
  getProject, setPersona, toggleSelection, isSelected, getCategoriesFor,
  setFaceMode, setReferenceImage, setIdentityLock,
  setHairMode, setCustomField,
  setDestination, setNegativeText, getNegativePrompt, getPositivePrompt,
  setPositiveManualText, clearPositiveManualOverride, toggleNegativeFragment,
  isNegativeFragmentActive, isPositivePromptStale,
  setCameraOrbitAngle, getCameraOrbitAngle, CAMERA_YAW_IDS,
} from "../state.js";
import { saveImageBlob } from "../storage.js";
import { renderStepProgress, renderCategoryAccordions, renderCustomTextField } from "../components/stepper.js";
import { renderCameraOrbit } from "../components/cameraOrbit.js";
import { mountPromptBar } from "../components/promptBar.js";
import { pickImportSource, resolveImportedFile } from "../components/importSource.js";
import { renderPrivacyThumb } from "../components/privacyThumb.js";
import { toast } from "../components/toast.js";
import { saveCharacterFromProject, saveProjectSnapshot } from "./gallery.js";

const STEPS = [
  { id: "persona", title: "Chi vuoi creare?", short: "Persona" },
  { id: "corpo", title: "Corpo", short: "Corpo" },
  { id: "volto", title: "Volto", short: "Volto" },
  { id: "capelli", title: "Capelli", short: "Capelli" },
  { id: "azione", title: "Azione e posa", short: "Azione" },
  { id: "scena", title: "Scena / ambiente", short: "Scena" },
  { id: "camera", title: "Camera e luce", short: "Camera" },
  { id: "finale", title: "Prompt finale", short: "Prompt" },
];

export async function render(container, params, { navigate, setHeader }) {
  const stepNum = Math.min(Math.max(parseInt(params[0] || "1", 10) || 1, 1), STEPS.length);
  const stepIndex = stepNum - 1;
  const step = STEPS[stepIndex];

  mountPromptBar(document.getElementById("promptBar"));
  setHeader("Crea personaggio / prompt", `Step ${stepNum} di ${STEPS.length} — ${step.short}`);

  container.innerHTML = "";
  const header = document.createElement("div");
  header.innerHTML = `<div class="step-header"><h2 class="step-title">${step.title}</h2></div>`;
  container.appendChild(header);
  renderStepProgress(container, stepIndex, STEPS.length, (i) => navigate(`/builder/${i + 1}`));

  const content = document.createElement("div");
  content.className = "stack";
  container.appendChild(content);

  const footer = document.createElement("div");
  footer.className = "footer-nav";
  container.appendChild(footer);

  const backBtn = document.createElement("button");
  backBtn.className = "btn";
  backBtn.textContent = "⬅ Indietro";
  backBtn.style.visibility = stepIndex === 0 ? "hidden" : "visible";
  backBtn.addEventListener("click", () => navigate(`/builder/${stepNum - 1}`));

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-primary";
  nextBtn.textContent = stepIndex === STEPS.length - 1 ? "Fatto" : "Avanti ➡";

  footer.appendChild(backBtn);
  footer.appendChild(nextBtn);

  function goNext() { navigate(`/builder/${stepNum + 1}`); }

  switch (step.id) {
    case "persona": renderPersona(content, nextBtn, goNext); break;
    case "corpo": renderCorpo(content); nextBtn.addEventListener("click", goNext); break;
    case "volto": renderVolto(content, nextBtn); nextBtn.addEventListener("click", goNext); break;
    case "capelli": renderCapelli(content); nextBtn.addEventListener("click", goNext); break;
    case "azione": renderAzionePosa(content); nextBtn.addEventListener("click", goNext); break;
    case "scena": renderScena(content); nextBtn.addEventListener("click", goNext); break;
    case "camera": renderCameraLuce(content); nextBtn.addEventListener("click", goNext); break;
    case "finale": nextBtn.remove(); renderFinale(content, { navigate }); break;
  }
}

// ---------------- STEP 1 — PERSONA ----------------
function renderPersona(container, nextBtn, goNext) {
  const p = getProject();
  const q = document.createElement("p");
  q.className = "step-question";
  q.textContent = "Prima scelta: chi vuoi creare?";
  container.appendChild(q);

  const grid = document.createElement("div");
  grid.className = "big-choices";
  grid.innerHTML = `
    <div class="big-choice" id="pDonna"><div class="ico">👩</div><div class="title">DONNA</div><div class="desc">woman</div></div>
    <div class="big-choice" id="pUomo"><div class="ico">👨</div><div class="title">UOMO</div><div class="desc">man</div></div>
  `;
  container.appendChild(grid);

  function mark() {
    grid.querySelector("#pDonna").style.borderColor = p.persona === "donna" ? "var(--gold)" : "";
    grid.querySelector("#pUomo").style.borderColor = p.persona === "uomo" ? "var(--gold)" : "";
    nextBtn.disabled = !p.persona;
  }
  grid.querySelector("#pDonna").addEventListener("click", () => { setPersona("donna"); mark(); goNext(); });
  grid.querySelector("#pUomo").addEventListener("click", () => { setPersona("uomo"); mark(); goNext(); });
  mark();
}

// ---------------- STEP 2 — CORPO ----------------
function renderCorpo(container) {
  const q = document.createElement("p");
  q.className = "step-question";
  q.textContent = "Componi il corpo del personaggio, categoria per categoria.";
  container.appendChild(q);

  const allCats = getCategoriesFor("body");
  const buildCats = allCats.filter((c) => !c.id.startsWith("anatomia_"));
  const anatomyCats = allCats.filter((c) => c.id.startsWith("anatomia_"));

  const toggleOpts = {
    onToggle: (catId, optId) => toggleSelection("body", catId, optId),
    isSelected: (catId, optId) => isSelected("body", catId, optId),
    stepKey: "body",
  };

  renderCategoryAccordions(container, buildCats, toggleOpts);

  const clothingTitle = document.createElement("h3");
  clothingTitle.textContent = "Abbigliamento / Nudità";
  clothingTitle.style.color = "var(--gold-soft)";
  clothingTitle.style.marginTop = "10px";
  container.appendChild(clothingTitle);
  const clothingHint = document.createElement("p");
  clothingHint.className = "faint";
  clothingHint.style.marginTop = "-4px";
  clothingHint.textContent = "Specifica se è nuda/o, in intimo o vestita/o — sempre a pulsanti, come tutto il resto.";
  container.appendChild(clothingHint);
  renderCategoryAccordions(container, getCategoriesFor("clothing"), {
    onToggle: (catId, optId) => toggleSelection("clothing", catId, optId),
    isSelected: (catId, optId) => isSelected("clothing", catId, optId),
    stepKey: "clothing",
  });

  const anatomyTitle = document.createElement("h3");
  anatomyTitle.textContent = "Anatomia — glossario completo";
  anatomyTitle.style.color = "var(--gold-soft)";
  anatomyTitle.style.marginTop = "10px";
  container.appendChild(anatomyTitle);
  const anatomyHint = document.createElement("p");
  anatomyHint.className = "faint";
  anatomyHint.style.marginTop = "-4px";
  anatomyHint.textContent = "Termini precisi per ogni zona del corpo, divisi per area — utile per dettagli e inquadrature ravvicinate.";
  container.appendChild(anatomyHint);
  renderCategoryAccordions(container, anatomyCats, toggleOpts);
}

// ---------------- STEP 3 — VOLTO ----------------
function renderVolto(container, nextBtn) {
  const p = getProject();
  const q = document.createElement("p");
  q.className = "step-question";
  q.textContent = "Da dove prendiamo il volto?";
  container.appendChild(q);

  const choiceGrid = document.createElement("div");
  choiceGrid.className = "big-choices";
  choiceGrid.innerHTML = `
    <div class="big-choice" id="fCreate"><div class="ico">🎨</div><div class="title">CREA IL VOLTO</div><div class="desc">Scegli caratteristiche una per una</div></div>
    <div class="big-choice" id="fRef"><div class="ico">📷</div><div class="title">USA FOTO DI RIFERIMENTO</div><div class="desc">Mantieni la stessa identità in ogni immagine</div></div>
  `;
  container.appendChild(choiceGrid);

  const sub = document.createElement("div");
  sub.className = "stack";
  sub.style.marginTop = "10px";
  container.appendChild(sub);

  function markChoice() {
    choiceGrid.querySelector("#fCreate").style.borderColor = p.faceMode === "create" ? "var(--gold)" : "";
    choiceGrid.querySelector("#fRef").style.borderColor = p.faceMode === "reference" ? "var(--gold)" : "";
    nextBtn.disabled = p.faceMode === "reference" && !p.referenceImageId;
  }

  function drawSub() {
    sub.innerHTML = "";
    if (p.faceMode === "create") {
      const cats = getCategoriesFor("face");
      renderCategoryAccordions(sub, cats, {
        onToggle: (catId, optId) => toggleSelection("face", catId, optId),
        isSelected: (catId, optId) => isSelected("face", catId, optId),
        stepKey: "face",
      });
    } else if (p.faceMode === "reference") {
      renderReferenceUpload(sub, markChoice);
    }
  }

  choiceGrid.querySelector("#fCreate").addEventListener("click", () => { setFaceMode("create"); markChoice(); drawSub(); });
  choiceGrid.querySelector("#fRef").addEventListener("click", () => { setFaceMode("reference"); markChoice(); drawSub(); });

  markChoice();
  drawSub();
}

function renderReferenceUpload(container, onChanged) {
  const p = getProject();
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h3>Fotografia di riferimento</h3>`;

  const preview = document.createElement("div");
  preview.style.marginBottom = "10px";
  card.appendChild(preview);

  async function drawPreview() {
    if (!p.referenceImageId) {
      preview.innerHTML = `<span class="faint">Nessuna foto caricata.</span>`;
      return;
    }
    await renderPrivacyThumb(preview, p.referenceImageId, { title: "Foto di riferimento", size: "160px" });
  }

  const btnRow = document.createElement("div");
  btnRow.className = "row";
  const uploadBtn = document.createElement("button");
  uploadBtn.className = "btn btn-primary";
  uploadBtn.textContent = "📷 Carica fotografia";
  uploadBtn.addEventListener("click", async () => {
    const picked = await pickImportSource({ accept: "image/*", title: "Importa fotografia di riferimento" });
    if (!picked) return;
    const file = await resolveImportedFile(picked);
    if (!file) { toast("Import non riuscito", { error: true }); return; }
    const id = await saveImageBlob(file, { kind: "reference", name: picked.name });
    setReferenceImage(id);
    toast("Foto di riferimento caricata. Modalità IDENTITY LOCK attiva.");
    drawPreview();
    onChanged();
  });
  btnRow.appendChild(uploadBtn);
  card.appendChild(btnRow);

  const lockRow = document.createElement("label");
  lockRow.className = "row";
  lockRow.style.marginTop = "10px";
  lockRow.innerHTML = `<input type="checkbox" id="lockChk" ${p.identityLock ? "checked" : ""}/> <span>Mantieni identità (PERSONAGGIO COERENTE / IDENTITY LOCK) — non modificare volto, occhi, naso, bocca, mascella, tonalità e texture della pelle</span>`;
  lockRow.querySelector("#lockChk").addEventListener("change", (e) => setIdentityLock(e.target.checked));
  card.appendChild(lockRow);

  drawPreview();
  container.appendChild(card);
}

// ---------------- STEP 4 — CAPELLI ----------------
function renderCapelli(container) {
  const p = getProject();
  const q = document.createElement("p");
  q.className = "step-question";
  container.appendChild(q);

  const sub = document.createElement("div");
  sub.className = "stack";
  container.appendChild(sub);

  if (p.referenceImageId) {
    q.textContent = "Vuoi mantenere i capelli della fotografia?";
    const grid = document.createElement("div");
    grid.className = "big-choices";
    grid.innerHTML = `
      <div class="big-choice" id="hKeep"><div class="ico">📌</div><div class="title">MANTIENI CAPELLI</div></div>
      <div class="big-choice" id="hChange"><div class="ico">✂️</div><div class="title">CAMBIA ACCONCIATURA</div></div>
    `;
    container.appendChild(grid);

    function mark() {
      grid.querySelector("#hKeep").style.borderColor = p.hairMode === "keep" ? "var(--gold)" : "";
      grid.querySelector("#hChange").style.borderColor = p.hairMode === "change" ? "var(--gold)" : "";
    }
    function drawSub() {
      sub.innerHTML = "";
      if (p.hairMode === "change") renderHairLibrary(sub);
    }
    grid.querySelector("#hKeep").addEventListener("click", () => { setHairMode("keep"); mark(); drawSub(); });
    grid.querySelector("#hChange").addEventListener("click", () => { setHairMode("change"); mark(); drawSub(); });
    mark(); drawSub();
  } else {
    q.textContent = "Scegli l'acconciatura del personaggio.";
    renderHairLibrary(sub);
  }
}

function renderHairLibrary(container) {
  const p = getProject();
  const cats = getCategoriesFor("hair");
  renderCategoryAccordions(container, cats, {
    onToggle: (catId, optId) => toggleSelection("hair", catId, optId),
    isSelected: (catId, optId) => isSelected("hair", catId, optId),
    stepKey: "hair",
  });
  renderCustomTextField(container, {
    label: "Acconciatura personalizzata",
    placeholder: "Descrivi un'acconciatura specifica...",
    value: p.customHair,
    onChange: (v) => setCustomField("customHair", v),
  });
}

// ---------------- STEP 5 — AZIONE E POSA ----------------
function renderAzionePosa(container) {
  const p = getProject();
  const q = document.createElement("p");
  q.className = "step-question";
  q.textContent = "Cosa sta facendo il personaggio, e con quale posa?";
  container.appendChild(q);

  const azTitle = document.createElement("h3");
  azTitle.textContent = "Azione";
  azTitle.style.color = "var(--gold-soft)";
  container.appendChild(azTitle);
  renderCategoryAccordions(container, getCategoriesFor("action"), {
    onToggle: (catId, optId) => toggleSelection("action", catId, optId),
    isSelected: (catId, optId) => isSelected("action", catId, optId),
    stepKey: "action",
  });
  renderCustomTextField(container, {
    label: "Azione personalizzata",
    placeholder: "Descrivi un'azione specifica...",
    value: p.customAction,
    onChange: (v) => setCustomField("customAction", v),
  });

  const poseTitle = document.createElement("h3");
  poseTitle.textContent = "Posa";
  poseTitle.style.color = "var(--gold-soft)";
  poseTitle.style.marginTop = "6px";
  container.appendChild(poseTitle);
  renderCategoryAccordions(container, getCategoriesFor("pose"), {
    onToggle: (catId, optId) => toggleSelection("pose", catId, optId),
    isSelected: (catId, optId) => isSelected("pose", catId, optId),
    stepKey: "pose",
  });
}

// ---------------- STEP 6 — SCENA ----------------
function renderScena(container) {
  const p = getProject();
  const q = document.createElement("p");
  q.className = "step-question";
  q.textContent = "Dove si trova?";
  container.appendChild(q);

  renderCategoryAccordions(container, getCategoriesFor("scene"), {
    onToggle: (catId, optId) => toggleSelection("scene", catId, optId),
    isSelected: (catId, optId) => isSelected("scene", catId, optId),
    stepKey: "scene",
  });
  renderCustomTextField(container, {
    label: "Descrivi la scena",
    placeholder: "Aggiungi dettagli liberi sulla scena...",
    value: p.customScene,
    onChange: (v) => setCustomField("customScene", v),
    multiline: true,
  });
}

// ---------------- STEP 7 — CAMERA E LUCE ----------------
function renderCameraLuce(container) {
  const camCats = getCategoriesFor("camera");
  const pvCat = camCats.find((c) => c.id === "punto_vista");
  const otherCamCats = camCats.filter((c) => c.id !== "punto_vista");
  const inquadraturaCats = otherCamCats.filter((c) => c.id === "inquadratura");
  const restCamCats = otherCamCats.filter((c) => c.id !== "inquadratura");

  const camTitle = document.createElement("h3");
  camTitle.textContent = "Camera";
  camTitle.style.color = "var(--gold-soft)";
  container.appendChild(camTitle);

  renderCategoryAccordions(container, inquadraturaCats, {
    onToggle: (catId, optId) => toggleSelection("camera", catId, optId),
    isSelected: (catId, optId) => isSelected("camera", catId, optId),
    stepKey: "camera",
  });

  if (pvCat) {
    const pvTitle = document.createElement("p");
    pvTitle.className = "step-question";
    pvTitle.textContent = "Punto di vista — telecamera interattiva";
    container.appendChild(pvTitle);
    renderCameraOrbit(container, {
      getSelected: getCameraOrbitAngle,
      onSelect: (id) => setCameraOrbitAngle(id),
    });

    const elevTitle = document.createElement("p");
    elevTitle.className = "step-question";
    elevTitle.style.marginTop = "10px";
    elevTitle.textContent = "Angolo verticale (extra)";
    container.appendChild(elevTitle);
    renderCategoryAccordions(container, [pvCat], {
      onToggle: (catId, optId) => toggleSelection("camera", catId, optId),
      isSelected: (catId, optId) => isSelected("camera", catId, optId),
      stepKey: "camera",
      openByDefault: new Set(["punto_vista"]),
      filterOptions: (opt) => !CAMERA_YAW_IDS.includes(opt.id),
    });
  }

  renderCategoryAccordions(container, restCamCats, {
    onToggle: (catId, optId) => toggleSelection("camera", catId, optId),
    isSelected: (catId, optId) => isSelected("camera", catId, optId),
    stepKey: "camera",
  });

  const lightTitle = document.createElement("h3");
  lightTitle.textContent = "Luce";
  lightTitle.style.color = "var(--gold-soft)";
  lightTitle.style.marginTop = "6px";
  container.appendChild(lightTitle);
  renderCategoryAccordions(container, getCategoriesFor("light"), {
    onToggle: (catId, optId) => toggleSelection("light", catId, optId),
    isSelected: (catId, optId) => isSelected("light", catId, optId),
    stepKey: "light",
  });
}

// ---------------- STEP 8 — PROMPT FINALE + DESTINAZIONE ----------------
function renderFinale(container, { navigate }) {
  const posCard = document.createElement("div");
  posCard.className = "card";
  posCard.innerHTML = `<h3>PROMPT POSITIVO</h3>`;

  const staleNote = document.createElement("div");
  staleNote.className = "manual-warning";
  staleNote.style.display = "none";
  posCard.appendChild(staleNote);

  const posBox = document.createElement("div");
  posBox.className = "prompt-box";
  posBox.contentEditable = "true";
  posBox.textContent = getPositivePrompt();
  posBox.addEventListener("input", () => {
    // ignore no-op events (focus/blur quirks on some browsers fire "input"
    // without any real change) — only freeze into manual mode on an actual edit
    if (posBox.textContent !== getPositivePrompt()) setPositiveManualText(posBox.textContent);
    refreshStaleNote();
  });
  posCard.appendChild(posBox);

  function refreshStaleNote() {
    if (isPositivePromptStale()) {
      staleNote.style.display = "";
      staleNote.innerHTML = `⚠️ Hai modificato questo prompt a mano: le modifiche fatte dopo negli step precedenti (es. Scena) <b>non</b> vengono aggiunte qui automaticamente. Premi "↻ Rigenera dagli step" per aggiornarlo (perderai le modifiche scritte a mano qui).`;
    } else {
      staleNote.style.display = "none";
    }
  }
  refreshStaleNote();

  const posBtnRow = document.createElement("div");
  posBtnRow.className = "row";
  posBtnRow.style.marginTop = "10px";
  const copyPos = mkBtn("📋 Copia positivo", () => copyText(getPositivePrompt()));
  const regen = mkBtn("↻ Rigenera dagli step", () => { clearPositiveManualOverride(); posBox.textContent = getPositivePrompt(); refreshStaleNote(); });
  posBtnRow.append(copyPos, regen);
  posCard.appendChild(posBtnRow);
  container.appendChild(posCard);

  const negCard = document.createElement("div");
  negCard.className = "card";
  negCard.innerHTML = `<h3>PROMPT NEGATIVO</h3>`;
  const negBox = document.createElement("div");
  negBox.className = "prompt-box negative";
  negBox.contentEditable = "true";
  negBox.textContent = getNegativePrompt();
  negBox.addEventListener("input", () => setNegativeText(negBox.textContent));
  negCard.appendChild(negBox);

  renderCategoryAccordions(negCard, getCategoriesFor("negative"), {
    onToggle: (catId, optId) => {
      const opt = getCategoriesFor("negative").find((c) => c.id === catId).options.find((o) => o.id === optId);
      toggleNegativeFragment(opt.frag);
      negBox.textContent = getNegativePrompt();
    },
    isSelected: (catId, optId) => {
      const opt = getCategoriesFor("negative").find((c) => c.id === catId).options.find((o) => o.id === optId);
      return isNegativeFragmentActive(opt.frag);
    },
    stepKey: "negative",
  });

  const negBtnRow = document.createElement("div");
  negBtnRow.className = "row";
  negBtnRow.style.marginTop = "10px";
  negBtnRow.appendChild(mkBtn("📋 Copia negativo", () => copyText(getNegativePrompt())));
  negCard.appendChild(negBtnRow);
  container.appendChild(negCard);

  const allRow = document.createElement("div");
  allRow.className = "row";
  allRow.appendChild(mkBtn("📋 Copia tutto", () => copyText(`POSITIVO:\n${getPositivePrompt()}\n\nNEGATIVO:\n${getNegativePrompt()}`), "btn-primary"));
  allRow.appendChild(mkBtn("💾 Salva personaggio in archivio", async () => {
    await saveCharacterFromProject();
    toast("Personaggio salvato in archivio.");
  }));
  container.appendChild(allRow);

  // ---------------- Destinazione ----------------
  const destCard = document.createElement("div");
  destCard.className = "card";
  destCard.innerHTML = `<h3>Dove vuoi generare?</h3>`;
  const destGrid = document.createElement("div");
  destGrid.className = "dest-grid";
  const destinations = [
    { id: "comfyui", label: "ComfyUI", ico: "🧩" },
    { id: "chatgpt", label: "ChatGPT", ico: "💬" },
    { id: "gemini", label: "Gemini", ico: "🔷" },
    { id: "metaai", label: "Meta AI", ico: "♾️" },
  ];
  destinations.forEach((d) => {
    const btn = document.createElement("div");
    btn.className = "big-choice";
    btn.innerHTML = `<div class="ico">${d.ico}</div><div class="title">${d.label}</div>`;
    btn.addEventListener("click", async () => {
      setDestination(d.id);
      await saveProjectSnapshot();
      if (d.id === "comfyui") { navigate("/comfy"); }
      else { navigate("/ai"); }
    });
    destGrid.appendChild(btn);
  });
  destCard.appendChild(destGrid);
  container.appendChild(destCard);
}

function mkBtn(label, onClick, cls = "btn") {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiato negli appunti.");
  } catch (e) {
    toast("Impossibile copiare automaticamente. Seleziona e copia manualmente.", { error: true });
  }
}
