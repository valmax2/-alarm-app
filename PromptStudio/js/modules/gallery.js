// ==========================================================================
// modules/gallery.js — ARCHIVIO: personaggi, reference pack, immagini
// generate, progetti salvati. Also exposes saveCharacterFromProject() /
// saveProjectSnapshot(), used by the Module 1 wizard.
// ==========================================================================

import { lsGet, lsSet, uid, listImages, saveImageBlob, deleteImage } from "../storage.js";
import { getProject, loadProjectObject } from "../state.js";
import { buildIdentityLockFragments } from "../data/face.js";
import { pickImportSource, resolveImportedFile } from "../components/importSource.js";
import { renderPrivacyThumb } from "../components/privacyThumb.js";
import { openImageFilterPicker } from "../components/imageFilters.js";
import { askText, askConfirm } from "../components/promptDialog.js";
import { toast } from "../components/toast.js";

const CHAR_KEY = "characters";
const PROJ_KEY = "saved_projects";

const REFERENCE_PACK_SLOTS = [
  "Volto frontale", "3/4 sinistra", "3/4 destra", "Profilo sinistro", "Profilo destro",
  "Vista posteriore", "Vista dall'alto", "Vista dal basso",
  "Close-up volto", "Mezzo busto", "Full body",
];

export function getCharacters() { return lsGet(CHAR_KEY, []); }
function saveCharacters(list) { lsSet(CHAR_KEY, list); }
function getSavedProjects() { return lsGet(PROJ_KEY, []); }
function saveSavedProjects(list) { lsSet(PROJ_KEY, list); }

// ---------------- called from the Module 1 wizard ----------------

export async function saveCharacterFromProject() {
  const p = getProject();
  const name = await askText({ title: "Nome del personaggio", placeholder: "Es. Elena" });
  if (!name) return null;
  const characters = getCharacters();
  const record = {
    id: uid("char"),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    persona: p.persona,
    mainImageId: p.referenceImageId || null,
    identityFragments: p.referenceImageId ? buildIdentityLockFragments() : [],
    referencePack: REFERENCE_PACK_SLOTS.map((label) => ({ id: uid("slot"), label, imageId: null })),
    sourceProjectId: p.id,
  };
  characters.push(record);
  saveCharacters(characters);
  return record.id;
}

export async function saveProjectSnapshot() {
  const p = getProject();
  const list = getSavedProjects();
  const existingIdx = list.findIndex((x) => x.id === p.id);
  const snapshot = { ...p, savedAt: Date.now() };
  if (existingIdx >= 0) list[existingIdx] = snapshot;
  else list.push(snapshot);
  saveSavedProjects(list);
}

// ---------------- routing ----------------

export async function render(container, params, { navigate, setHeader }) {
  const [sub, id] = params;
  if (sub === "character" && id) { setHeader("Archivio", "Personaggio"); return renderCharacterDetail(container, id, navigate); }
  if (sub === "characters") { setHeader("Archivio", "Personaggi"); return renderCharactersList(container, navigate); }
  if (sub === "projects") { setHeader("Archivio", "Progetti salvati"); return renderProjects(container, navigate); }
  if (sub === "images") { setHeader("Archivio", "Immagini"); return renderImages(container, navigate); }
  setHeader("Archivio", "");
  return renderHub(container, navigate);
}

function renderHub(container, navigate) {
  const chars = getCharacters();
  const projects = getSavedProjects();
  container.innerHTML = `
    <div class="big-choices">
      <div class="big-choice" id="goChars"><div class="ico">🧑‍🤝‍🧑</div><div class="title">PERSONAGGI</div><div class="desc">${chars.length} salvati</div></div>
      <div class="big-choice" id="goProjects"><div class="ico">📁</div><div class="title">PROGETTI</div><div class="desc">${projects.length} salvati</div></div>
      <div class="big-choice" id="goImages"><div class="ico">🖼️</div><div class="title">IMMAGINI</div><div class="desc">Reference e generate</div></div>
      <div class="big-choice" id="goWorkflows"><div class="ico">🧩</div><div class="title">WORKFLOW</div><div class="desc">Apri la libreria in ComfyUI Studio</div></div>
    </div>
  `;
  container.querySelector("#goChars").addEventListener("click", () => navigate("/gallery/characters"));
  container.querySelector("#goProjects").addEventListener("click", () => navigate("/gallery/projects"));
  container.querySelector("#goImages").addEventListener("click", () => navigate("/gallery/images"));
  container.querySelector("#goWorkflows").addEventListener("click", () => navigate("/comfy/workflows"));
}

async function renderCharactersList(container, navigate) {
  const chars = getCharacters();
  container.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:10px;">
      <h2 class="step-title" style="margin:0;">Personaggi</h2>
    </div><div id="grid" class="thumb-grid"></div>`;
  const grid = container.querySelector("#grid");
  if (!chars.length) { grid.innerHTML = `<span class="faint">Nessun personaggio salvato ancora. Salvane uno dallo Step 8 del percorso guidato.</span>`; return; }

  for (const c of chars) {
    const cell = document.createElement("div");
    cell.style.cursor = "pointer";
    cell.addEventListener("click", () => navigate(`/gallery/character/${c.id}`));
    grid.appendChild(cell);

    if (c.mainImageId) {
      await renderPrivacyThumb(cell, c.mainImageId, { title: c.name, overlay: nameLabel(c.name), zoomable: false });
    } else {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.textContent = c.name;
      cell.appendChild(thumb);
    }
  }
}

async function renderCharacterDetail(container, id, navigate) {
  const chars = getCharacters();
  const idx = chars.findIndex((c) => c.id === id);
  if (idx < 0) { container.innerHTML = `<p class="muted">Personaggio non trovato.</p>`; return; }
  const c = chars[idx];

  function persist() { chars[idx] = c; saveCharacters(chars); }

  container.innerHTML = `<h2 class="step-title">${c.name}</h2>`;

  const mainCard = document.createElement("div");
  mainCard.className = "card";
  mainCard.innerHTML = `<h3>Foto principale</h3>`;
  const mainWrap = document.createElement("div");
  mainWrap.className = "row";
  mainCard.appendChild(mainWrap);
  container.appendChild(mainCard);

  async function drawMain() {
    mainWrap.innerHTML = "";
    const thumbHolder = document.createElement("div");
    if (c.mainImageId) {
      await renderPrivacyThumb(thumbHolder, c.mainImageId, { title: c.name, size: "140px" });
    } else {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.style.width = "140px";
      thumb.innerHTML = `<span class="faint">Nessuna foto</span>`;
      thumbHolder.appendChild(thumb);
    }
    mainWrap.appendChild(thumbHolder);

    const btns = document.createElement("div");
    btns.className = "stack";
    const uploadBtn = mkBtn(c.mainImageId ? "Sostituisci foto" : "Carica foto", async () => {
      const picked = await pickImportSource({ accept: "image/*", title: "Carica foto principale" });
      if (!picked) return;
      const file = await resolveImportedFile(picked);
      const imgId = await saveImageBlob(file, { kind: "character-main", characterId: c.id });
      c.mainImageId = imgId;
      persist();
      drawMain();
    });
    btns.appendChild(uploadBtn);
    btns.appendChild(mkBtn("Usa in Prompt Builder", () => {
      const p = getProject();
      p.referenceImageId = c.mainImageId;
      p.faceMode = "reference";
      p.identityLock = true;
      loadProjectObject(p);
      toast(`Reference di "${c.name}" caricata nel progetto in corso.`);
      navigate("/builder/8");
    }));
    if (c.mainImageId) {
      btns.appendChild(mkBtn("🤖 Modifica con IA esterna", () => {
        const p = getProject();
        p.referenceImageId = c.mainImageId;
        p.faceMode = "reference";
        p.identityLock = true;
        loadProjectObject(p);
        toast(`"${c.name}" caricata: scrivi che modifica vuoi chiedere all'IA.`);
        navigate("/ai");
      }));
    }
    mainWrap.appendChild(btns);
  }
  await drawMain();

  const packCard = document.createElement("div");
  packCard.className = "card";
  packCard.innerHTML = `<h3>Reference Pack</h3><p class="faint">Immagini coerenti del personaggio per mantenere l'identità nei workflow successivi.</p>`;
  const packGrid = document.createElement("div");
  packGrid.className = "thumb-grid";
  packCard.appendChild(packGrid);
  container.appendChild(packCard);

  for (const slot of c.referencePack) {
    const holder = document.createElement("div");
    packGrid.appendChild(holder);

    async function drawSlot() {
      if (slot.imageId) {
        await renderPrivacyThumb(holder, slot.imageId, { title: slot.label, overlay: smallLabel(slot.label) });
        return;
      }
      holder.innerHTML = "";
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const addLbl = document.createElement("span");
      addLbl.textContent = "➕ " + slot.label;
      addLbl.style.cursor = "pointer";
      addLbl.addEventListener("click", async () => {
        const picked = await pickImportSource({ accept: "image/*", title: `Carica: ${slot.label}` });
        if (!picked) return;
        const file = await resolveImportedFile(picked);
        slot.imageId = await saveImageBlob(file, { kind: "reference-pack", characterId: c.id, label: slot.label });
        persist();
        drawSlot();
      });
      thumb.appendChild(addLbl);
      thumb.appendChild(smallLabel(slot.label));
      holder.appendChild(thumb);
    }
    drawSlot();
  }

  const dangerRow = document.createElement("div");
  dangerRow.className = "row";
  dangerRow.style.marginTop = "16px";
  dangerRow.appendChild(mkBtn("✏️ Rinomina", async () => {
    const name = await askText({ title: "Nuovo nome", value: c.name });
    if (name) { c.name = name; persist(); container.querySelector(".step-title").textContent = name; }
  }));
  dangerRow.appendChild(mkBtn("🗑️ Elimina personaggio", async () => {
    if (!(await askConfirm(`Eliminare "${c.name}"? L'operazione non è reversibile.`))) return;
    saveCharacters(chars.filter((x) => x.id !== c.id));
    toast("Personaggio eliminato.");
    navigate("/gallery/characters");
  }, "btn btn-danger"));
  container.appendChild(dangerRow);
}

async function renderProjects(container, navigate) {
  const projects = getSavedProjects().sort((a, b) => b.savedAt - a.savedAt);
  container.innerHTML = `<h2 class="step-title">Progetti salvati</h2><div id="list" class="stack"></div>`;
  const list = container.querySelector("#list");
  if (!projects.length) { list.innerHTML = `<span class="faint">Nessun progetto salvato ancora.</span>`; return; }
  projects.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="row" style="justify-content:space-between;">
      <div><strong>${p.name || "Progetto senza nome"}</strong><br/><span class="faint">${new Date(p.savedAt).toLocaleString("it-IT")} — ${p.persona || "?"}</span></div>
      <div class="row"><button class="btn btn-sm" data-act="open">Apri</button><button class="btn btn-sm btn-danger" data-act="del">Elimina</button></div>
    </div>`;
    card.querySelector('[data-act="open"]').addEventListener("click", () => {
      loadProjectObject(p);
      navigate("/builder/8");
    });
    card.querySelector('[data-act="del"]').addEventListener("click", () => {
      saveSavedProjects(getSavedProjects().filter((x) => x.id !== p.id));
      renderProjects(container, navigate);
    });
    list.appendChild(card);
  });
}

async function renderImages(container) {
  container.innerHTML = `<h2 class="step-title">Tutte le immagini</h2><div id="grid" class="thumb-grid"></div>`;
  const grid = container.querySelector("#grid");
  const images = (await listImages()).sort((a, b) => b.meta.createdAt - a.meta.createdAt);
  if (!images.length) { grid.innerHTML = `<span class="faint">Nessuna immagine ancora.</span>`; return; }
  for (const rec of images) {
    const outer = document.createElement("div");
    grid.appendChild(outer);

    const holder = document.createElement("div");
    outer.appendChild(holder);

    const del = document.createElement("div");
    del.className = "eye-toggle";
    del.style.left = "4px"; del.style.right = "auto";
    del.textContent = "🗑️";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!(await askConfirm("Eliminare questa immagine?"))) return;
      await deleteImage(rec.id);
      outer.remove();
    });

    await renderPrivacyThumb(holder, rec.id, { title: rec.meta.kind || "", overlay: del });

    if (rec.meta.kind === "generated") {
      const filterBtn = document.createElement("button");
      filterBtn.type = "button";
      filterBtn.className = "btn filter-btn";
      filterBtn.style.cssText = "margin-top:4px;width:100%;";
      filterBtn.textContent = "🎨 Filtri";
      filterBtn.addEventListener("click", () => {
        openImageFilterPicker(rec.id, { onSaved: () => renderImages(container) });
      });
      outer.appendChild(filterBtn);
    }
  }
}

function nameLabel(text) {
  const label = document.createElement("div");
  label.style.cssText = "position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);font-size:.72rem;padding:3px 4px;color:#fff;";
  label.textContent = text;
  return label;
}

function smallLabel(text) {
  const label = document.createElement("div");
  label.style.cssText = "position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);font-size:.68rem;padding:2px 3px;color:#fff;";
  label.textContent = text;
  return label;
}

function mkBtn(label, onClick, cls = "btn") {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
