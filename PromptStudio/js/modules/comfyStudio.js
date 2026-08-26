// ==========================================================================
// modules/comfyStudio.js — MODULO 2: COMFYUI STUDIO
//
// Technically separate from the creative Prompt Builder. Handles the Bridge
// connection, the model/node inventory, the workflow library + editor, and
// sending a generation job to the local ComfyUI server.
// ==========================================================================

import { lsGet, lsSet } from "../storage.js";
import {
  getBridgeConfig, setBridgeConfig, checkHealth, pushConfigToBridge,
  fetchInventory, rescanInventory, listWorkflows, getWorkflow,
  saveWorkflowToLibrary, deleteWorkflow, generateWorkflow, getGenerationStatus,
  getGeneratedImageUrl, uploadInputImage,
} from "./comfyBridge.js";
import { extractParams, setNodeInput, findImageNodes, isApiFormat } from "./workflowParams.js";
import { detectFamily, compareCompatibility, badgeLabel } from "./compat.js";
import { pickImportSource, resolveImportedFile } from "../components/importSource.js";
import { openImageViewer } from "../components/imageViewer.js";
import { toast } from "../components/toast.js";
import { getProject, getPositivePrompt, getNegativePrompt } from "../state.js";

const WF_KEY = "comfy_active_workflow";

function getActiveWorkflow() { return lsGet(WF_KEY, null); }
function setActiveWorkflow(wf) { lsSet(WF_KEY, wf); }

export async function render(container, params, { navigate, setHeader }) {
  const sub = params[0] || "";
  container.innerHTML = "";

  switch (sub) {
    case "config": setHeader("ComfyUI Studio", "Configurazione"); renderConfig(container, navigate); break;
    case "inventory": setHeader("ComfyUI Studio", "Inventario"); await renderInventory(container, navigate); break;
    case "workflows": setHeader("ComfyUI Studio", "Libreria workflow"); await renderWorkflows(container, navigate); break;
    case "editor": setHeader("ComfyUI Studio", "Editor workflow"); renderEditor(container, navigate); break;
    case "generate": setHeader("ComfyUI Studio", "Genera"); renderGenerate(container, navigate); break;
    default: setHeader("ComfyUI Studio", "Panoramica"); renderHub(container, navigate); break;
  }
}

function renderHub(container, navigate) {
  const bridge = getBridgeConfig();
  const wf = getActiveWorkflow();

  container.innerHTML = `
    <div class="card">
      <h3>Stato Bridge</h3>
      <p class="muted">${bridge.connected
        ? `🟢 Connesso — ${bridge.baseUrl}`
        : "🔴 Non connesso. Avvia AVVIA_BRIDGE.bat sul PC e configura la connessione."}</p>
    </div>
    <div class="big-choices">
      <div class="big-choice" id="cConfig"><div class="ico">⚙️</div><div class="title">CONFIGURAZIONE</div><div class="desc">Bridge, cartella ComfyUI, cartella personale</div></div>
      <div class="big-choice" id="cInventory"><div class="ico">📦</div><div class="title">INVENTARIO</div><div class="desc">Nodi, checkpoint, LoRA, VAE, ControlNet...</div></div>
      <div class="big-choice" id="cWorkflows"><div class="ico">🗂️</div><div class="title">LIBRERIA WORKFLOW</div><div class="desc">Importa, cerca, seleziona, elimina</div></div>
      <div class="big-choice" id="cEditor"><div class="ico">🛠️</div><div class="title">EDITOR WORKFLOW</div><div class="desc">${wf ? `Attivo: ${wf.name}` : "Nessun workflow selezionato"}</div></div>
      <div class="big-choice" id="cGenerate"><div class="ico">🚀</div><div class="title">GENERA</div><div class="desc">Invia il workflow a ComfyUI</div></div>
    </div>
  `;
  container.querySelector("#cConfig").addEventListener("click", () => navigate("/comfy/config"));
  container.querySelector("#cInventory").addEventListener("click", () => navigate("/comfy/inventory"));
  container.querySelector("#cWorkflows").addEventListener("click", () => navigate("/comfy/workflows"));
  container.querySelector("#cEditor").addEventListener("click", () => navigate("/comfy/editor"));
  container.querySelector("#cGenerate").addEventListener("click", () => navigate("/comfy/generate"));
}

// ---------------- CONFIGURAZIONE ----------------
function renderConfig(container, navigate) {
  const cfg = getBridgeConfig();
  container.innerHTML = `
    <div class="card">
      <h3>Connessione al Bridge locale</h3>
      <p class="faint">Il Bridge è il piccolo programma (bridge_server.py / AVVIA_BRIDGE.bat) che gira sul tuo PC accanto a ComfyUI. Legge solo le cartelle che indichi qui, non l'intero computer.</p>
      <div class="text-field-row"><input type="text" id="baseUrl" value="${cfg.baseUrl}" placeholder="http://127.0.0.1:8765"/></div>
      <div class="row" style="margin-top:10px;">
        <button class="btn btn-primary" id="testConn">🔌 Testa connessione</button>
        <span id="connStatus" class="faint"></span>
      </div>
    </div>
    <div class="card">
      <h3>Cartella ComfyUI</h3>
      <p class="faint">Esempio: H:\\ComfyUI_Windows_portable\\ComfyUI</p>
      <div class="text-field-row"><input type="text" id="comfyRoot" value="${cfg.comfyRoot || ""}" placeholder="Percorso cartella ComfyUI"/></div>
    </div>
    <div class="card">
      <h3>Cartella file personali (opzionale)</h3>
      <p class="faint">Esempio: D:\\Immagini_AI</p>
      <div class="text-field-row"><input type="text" id="personalRoot" value="${cfg.personalRoot || ""}" placeholder="Percorso cartella personale"/></div>
    </div>
    <div class="row">
      <button class="btn btn-primary" id="saveCfg">💾 Salva e scansiona</button>
    </div>
  `;

  container.querySelector("#testConn").addEventListener("click", async () => {
    setBridgeConfig({ baseUrl: container.querySelector("#baseUrl").value.trim() });
    const statusEl = container.querySelector("#connStatus");
    statusEl.textContent = "Verifica in corso...";
    try {
      const h = await checkHealth();
      statusEl.textContent = `🟢 Connesso (Bridge v${h.version || "?"})`;
    } catch (e) {
      statusEl.textContent = `🔴 ${e.message}`;
    }
  });

  container.querySelector("#saveCfg").addEventListener("click", async () => {
    setBridgeConfig({
      baseUrl: container.querySelector("#baseUrl").value.trim(),
      comfyRoot: container.querySelector("#comfyRoot").value.trim(),
      personalRoot: container.querySelector("#personalRoot").value.trim(),
    });
    try {
      await pushConfigToBridge();
      await rescanInventory();
      toast("Configurazione salvata e cartelle scansionate.");
      navigate("/comfy/inventory");
    } catch (e) {
      toast(`Impossibile contattare il Bridge: ${e.message}`, { error: true });
    }
  });
}

// ---------------- INVENTARIO ----------------
async function renderInventory(container, navigate) {
  container.innerHTML = `<p class="muted">Caricamento inventario dal Bridge...</p>`;
  let inv;
  try {
    inv = await fetchInventory();
  } catch (e) {
    container.innerHTML = `
      <div class="card">
        <h3>Bridge non raggiungibile</h3>
        <p class="muted">${e.message}</p>
        <button class="btn btn-primary" id="goConfig">Vai a Configurazione</button>
        <hr style="border-color:rgba(201,160,99,.15);margin:14px 0;"/>
        <h3>Importazione manuale</h3>
        <p class="faint">In alternativa puoi importare un inventario TXT/JSON esportato in precedenza.</p>
        <button class="btn" id="importInv">📥 Importa TXT/JSON</button>
      </div>`;
    container.querySelector("#goConfig").addEventListener("click", () => navigate("/comfy/config"));
    container.querySelector("#importInv").addEventListener("click", async () => {
      const picked = await pickImportSource({ accept: ".json,.txt", title: "Importa inventario" });
      if (!picked) return;
      const file = await resolveImportedFile(picked);
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        lsSet("manual_inventory", json);
        toast("Inventario importato manualmente.");
        renderInventory(container, navigate);
      } catch {
        toast("File non valido: atteso JSON.", { error: true });
      }
    });
    inv = lsGet("manual_inventory", null);
    if (!inv) return;
  }

  const groups = [
    ["checkpoints", "Checkpoint"], ["loras", "LoRA"], ["vae", "VAE"],
    ["text_encoders", "Text Encoder"], ["clip", "CLIP"], ["controlnet", "ControlNet"],
    ["upscale_models", "Upscaler"], ["diffusion_models", "Diffusion Model"],
    ["unet", "UNet"], ["custom_nodes", "Custom Node"],
  ];

  container.innerHTML = `
    <div class="row" style="justify-content:space-between;">
      <span class="muted">Scansione: ${inv.scanned_at ? new Date(inv.scanned_at).toLocaleString("it-IT") : "—"}</span>
      <button class="btn btn-sm" id="rescan">↻ Riscansiona</button>
    </div>
  `;

  groups.forEach(([key, label]) => {
    const items = inv[key] || [];
    const box = document.createElement("div");
    box.className = "category open";
    box.innerHTML = `<div class="category-head"><span class="name">${label}<span class="category-badge">${items.length}</span></span><span class="chev">▶</span></div>`;
    const body = document.createElement("div");
    body.className = "category-body";
    box.querySelector(".category-head").addEventListener("click", () => box.classList.toggle("open"));

    if (!items.length) {
      body.innerHTML = `<span class="faint">Nessun elemento trovato.</span>`;
    } else {
      const list = document.createElement("div");
      list.className = "stack";
      items.forEach((it) => {
        const name = typeof it === "string" ? it : it.name;
        const det = typeof it === "string" ? {} : it;
        const fam = detectFamily({ name, path: det.path || "", metadata: det.metadata || {} });
        const row = document.createElement("div");
        row.className = "row";
        row.style.justifyContent = "space-between";
        row.innerHTML = `<span>${name}</span><span class="badge ${fam.confidence === "high" ? "badge-green" : "badge-yellow"}">${fam.family === "unknown" ? "Famiglia non determinabile" : fam.family}</span>`;
        list.appendChild(row);
      });
      body.appendChild(list);
    }
    box.appendChild(body);
    container.appendChild(box);
  });

  const rescanBtn = container.querySelector("#rescan");
  if (rescanBtn) rescanBtn.addEventListener("click", async () => {
    try { await rescanInventory(); toast("Rescansione completata."); await renderInventory(container, navigate); }
    catch (e) { toast(e.message, { error: true }); }
  });
}

// ---------------- LIBRERIA WORKFLOW ----------------
async function renderWorkflows(container, navigate) {
  container.innerHTML = `
    <div class="row">
      <button class="btn btn-primary" id="importWf">📥 Importa workflow JSON</button>
    </div>
    <div id="wfList" class="stack" style="margin-top:12px;"><p class="muted">Caricamento...</p></div>
  `;

  container.querySelector("#importWf").addEventListener("click", async () => {
    const picked = await pickImportSource({ accept: ".json", title: "Importa workflow JSON" });
    if (!picked) return;
    const file = await resolveImportedFile(picked);
    const text = await file.text();
    let json;
    try { json = JSON.parse(text); } catch { toast("JSON non valido.", { error: true }); return; }
    if (!isApiFormat(json)) {
      toast("Attenzione: sembra un workflow in formato UI (non API). L'editor visuale sarà limitato; potrai comunque usare l'editor JSON.", { error: true, ms: 5000 });
    }
    try {
      await saveWorkflowToLibrary(picked.name.replace(/\.json$/i, ""), json);
      toast("Workflow salvato nella libreria.");
    } catch (e) {
      // Bridge unreachable: keep it purely local as the active workflow.
      setActiveWorkflow({ name: picked.name.replace(/\.json$/i, ""), path: null, json });
      toast("Bridge non raggiungibile: workflow caricato solo in locale come attivo.");
      navigate("/comfy/editor");
      return;
    }
    await loadList();
  });

  async function loadList() {
    const listEl = container.querySelector("#wfList");
    try {
      const items = await listWorkflows();
      if (!items.length) { listEl.innerHTML = `<p class="muted">Nessun workflow in libreria. Importane uno.</p>`; return; }
      listEl.innerHTML = "";
      items.forEach((wf) => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="row" style="justify-content:space-between;">
            <div><strong>${wf.name}</strong><br/><span class="faint">${wf.path}</span></div>
            <div class="row">
              <button class="btn btn-sm" data-act="select">Seleziona</button>
              <button class="btn btn-sm btn-danger" data-act="delete">Elimina</button>
            </div>
          </div>`;
        card.querySelector('[data-act="select"]').addEventListener("click", async () => {
          try {
            const json = await getWorkflow(wf.path);
            setActiveWorkflow({ name: wf.name, path: wf.path, json });
            toast(`Workflow "${wf.name}" selezionato.`);
            navigate("/comfy/editor");
          } catch (e) { toast(e.message, { error: true }); }
        });
        card.querySelector('[data-act="delete"]').addEventListener("click", async () => {
          try { await deleteWorkflow(wf.path); toast("Workflow eliminato."); await loadList(); }
          catch (e) { toast(e.message, { error: true }); }
        });
        listEl.appendChild(card);
      });
    } catch (e) {
      listEl.innerHTML = `<p class="muted">Bridge non raggiungibile: ${e.message}. Puoi comunque importare un workflow: verrà usato solo in locale.</p>`;
    }
  }
  await loadList();
}

// ---------------- EDITOR WORKFLOW ----------------
function renderEditor(container, navigate) {
  const wf = getActiveWorkflow();
  if (!wf) {
    container.innerHTML = `<div class="card"><h3>Nessun workflow selezionato</h3><p class="muted">Vai nella libreria e scegli un workflow.</p><button class="btn btn-primary" id="goLib">Apri libreria workflow</button></div>`;
    container.querySelector("#goLib").addEventListener("click", () => navigate("/comfy/workflows"));
    return;
  }

  container.innerHTML = `<h3 style="color:var(--gold-soft);margin:2px 0 8px;">${wf.name}</h3>`;

  if (!isApiFormat(wf.json)) {
    container.innerHTML += `<div class="card"><p class="muted">Questo workflow è in formato "UI" (non API): i parametri riconoscibili non sono disponibili in forma visuale. Usa l'editor JSON avanzato qui sotto, oppure ri-esporta da ComfyUI con "Save (API Format)".</p></div>`;
    renderJsonEditor(container, wf, navigate);
    return;
  }

  const params = extractParams(wf.json);

  if (params.checkpoints.length) {
    const box = sectionCard("Checkpoint");
    params.checkpoints.forEach((c) => {
      const fam = detectFamily({ name: c.value || "" });
      const row = fieldRow(c.title, c.value, (v) => { setNodeInput(wf.json, c.nodeId, "ckpt_name", v); persist(wf); });
      row.appendChild(compatBadge(fam));
      box.appendChild(row);
    });
    container.appendChild(box);
  }

  if (params.loras.length) {
    const box = sectionCard("LoRA");
    params.loras.forEach((l) => {
      const row = fieldRow(l.title, l.value, (v) => { setNodeInput(wf.json, l.nodeId, "lora_name", v); persist(wf); });
      const famLora = detectFamily({ name: l.value || "" });
      const ckptFam = params.checkpoints[0] ? detectFamily({ name: params.checkpoints[0].value || "" }) : null;
      const cmp = ckptFam ? compareCompatibility(ckptFam, famLora) : { level: "yellow" };
      const badge = document.createElement("span");
      badge.className = `badge badge-${cmp.level}`;
      badge.textContent = badgeLabel(cmp.level);
      badge.title = cmp.reason || "";
      row.appendChild(badge);
      box.appendChild(row);

      if (l.strengthModel !== undefined) {
        box.appendChild(sliderRow(`Peso modello (${l.title})`, l.strengthModel, 0, 2, 0.05, (v) => { setNodeInput(wf.json, l.nodeId, "strength_model", v); persist(wf); }));
      }
      if (l.strengthClip !== undefined) {
        box.appendChild(sliderRow(`Peso CLIP (${l.title})`, l.strengthClip, 0, 2, 0.05, (v) => { setNodeInput(wf.json, l.nodeId, "strength_clip", v); persist(wf); }));
      }
    });
    container.appendChild(box);
  }

  if (params.textPrompts.length) {
    const box = sectionCard("Prompt");
    params.textPrompts.forEach((p) => {
      box.appendChild(textAreaRow(`${p.title} ${p.role !== "unknown" ? `(${p.role === "positive" ? "positivo" : "negativo"})` : ""}`, p.text || "", (v) => { setNodeInput(wf.json, p.nodeId, "text", v); persist(wf); }));
    });
    const fillBtn = document.createElement("button");
    fillBtn.className = "btn btn-sm";
    fillBtn.textContent = "⬇️ Riempi da Prompt Studio (Module 1)";
    fillBtn.addEventListener("click", () => {
      params.textPrompts.forEach((p) => {
        const text = p.role === "negative" ? getNegativePrompt() : getPositivePrompt();
        setNodeInput(wf.json, p.nodeId, "text", text);
      });
      persist(wf);
      renderEditor(container, navigate);
    });
    box.appendChild(fillBtn);
    container.appendChild(box);
  }

  if (params.samplers.length) {
    const box = sectionCard("Sampler (KSampler)");
    params.samplers.forEach((s) => {
      box.appendChild(fieldRow(`${s.title} — seed`, s.seed, (v) => { setNodeInput(wf.json, s.nodeId, "seed", Number(v)); persist(wf); }, "number"));
      box.appendChild(sliderRow(`${s.title} — steps`, s.steps, 1, 100, 1, (v) => { setNodeInput(wf.json, s.nodeId, "steps", Math.round(v)); persist(wf); }));
      box.appendChild(sliderRow(`${s.title} — CFG`, s.cfg, 0, 20, 0.5, (v) => { setNodeInput(wf.json, s.nodeId, "cfg", v); persist(wf); }));
      box.appendChild(sliderRow(`${s.title} — denoise`, s.denoise, 0, 1, 0.01, (v) => { setNodeInput(wf.json, s.nodeId, "denoise", v); persist(wf); }));
    });
    container.appendChild(box);
  }

  if (params.latents.length) {
    const box = sectionCard("Dimensioni immagine");
    params.latents.forEach((l) => {
      box.appendChild(fieldRow(`${l.title} — width`, l.width, (v) => { setNodeInput(wf.json, l.nodeId, "width", Number(v)); persist(wf); }, "number"));
      box.appendChild(fieldRow(`${l.title} — height`, l.height, (v) => { setNodeInput(wf.json, l.nodeId, "height", Number(v)); persist(wf); }, "number"));
    });
    container.appendChild(box);
  }

  if (params.loadImages.length) {
    const box = sectionCard("Immagini nel workflow (Load Image)");
    const p = getProject();
    params.loadImages.forEach((li) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.justifyContent = "space-between";
      row.innerHTML = `<span>${li.title}<br/><span class="faint">${li.value || "(nessuna)"}</span></span>`;
      const btn = document.createElement("button");
      btn.className = "btn btn-sm";
      btn.textContent = p.referenceImageId ? "Usa reference del progetto" : "Assegna immagine";
      btn.addEventListener("click", async () => {
        const picked = await pickImportSource({ accept: "image/*", title: `Assegna immagine a ${li.title}` });
        if (!picked) return;
        const file = await resolveImportedFile(picked);
        try {
          const { filename } = await uploadInputImage(file);
          setNodeInput(wf.json, li.nodeId, "image", filename);
          persist(wf);
          toast(`Immagine "${filename}" caricata nella cartella input di ComfyUI e collegata al nodo.`);
        } catch (e) {
          toast(`Bridge non raggiungibile (${e.message}): imposto solo il nome file, copiala manualmente in ComfyUI/input.`, { error: true, ms: 6000 });
          setNodeInput(wf.json, li.nodeId, "image", file.name);
          persist(wf);
        }
      });
      row.appendChild(btn);
      box.appendChild(row);
    });
    container.appendChild(box);
  }

  renderJsonEditor(container, wf, navigate);

  const goGen = document.createElement("button");
  goGen.className = "btn btn-primary";
  goGen.textContent = "🚀 Vai a Genera";
  goGen.style.marginTop = "10px";
  goGen.addEventListener("click", () => navigate("/comfy/generate"));
  container.appendChild(goGen);
}

function persist(wf) { setActiveWorkflow(wf); }

function sectionCard(title) {
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<h3>${title}</h3>`;
  return box;
}
function fieldRow(label, value, onChange, type = "text") {
  const row = document.createElement("div");
  row.className = "row";
  row.style.justifyContent = "space-between";
  row.style.marginBottom = "8px";
  const span = document.createElement("span");
  span.textContent = label;
  span.style.flex = "1 1 auto";
  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  input.style.maxWidth = "160px";
  input.style.background = "var(--bg-elev-2)";
  input.style.border = "1px solid rgba(201,160,99,.3)";
  input.style.color = "var(--text)";
  input.style.borderRadius = "8px";
  input.style.padding = "6px 8px";
  input.addEventListener("change", () => onChange(input.value));
  row.appendChild(span);
  row.appendChild(input);
  return row;
}
function sliderRow(label, value, min, max, step, onChange) {
  const row = document.createElement("div");
  row.style.marginBottom = "10px";
  const top = document.createElement("div");
  top.className = "row";
  top.style.justifyContent = "space-between";
  const span = document.createElement("span");
  span.textContent = label;
  const valSpan = document.createElement("span");
  valSpan.className = "faint";
  valSpan.textContent = value;
  top.append(span, valSpan);
  const input = document.createElement("input");
  input.type = "range";
  input.min = min; input.max = max; input.step = step; input.value = value ?? min;
  input.style.width = "100%";
  input.addEventListener("input", () => { valSpan.textContent = input.value; onChange(Number(input.value)); });
  row.appendChild(top);
  row.appendChild(input);
  return row;
}
function textAreaRow(label, value, onChange) {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "10px";
  const lbl = document.createElement("div");
  lbl.className = "faint";
  lbl.textContent = label;
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.rows = 3;
  ta.style.width = "100%";
  ta.style.background = "var(--bg-elev-2)";
  ta.style.border = "1px solid rgba(201,160,99,.3)";
  ta.style.color = "var(--text)";
  ta.style.borderRadius = "8px";
  ta.style.padding = "8px";
  ta.addEventListener("input", () => onChange(ta.value));
  wrap.append(lbl, ta);
  return wrap;
}
function compatBadge(fam) {
  const badge = document.createElement("span");
  const level = fam.confidence === "high" ? "green" : "yellow";
  badge.className = `badge badge-${level}`;
  badge.textContent = fam.family === "unknown" ? "Famiglia non determinabile" : fam.family;
  return badge;
}

function renderJsonEditor(container, wf, navigate) {
  const box = sectionCard("Editor JSON avanzato");
  const ta = document.createElement("textarea");
  ta.value = JSON.stringify(wf.json, null, 2);
  ta.rows = 12;
  ta.style.width = "100%";
  ta.style.fontFamily = "monospace";
  ta.style.fontSize = ".78rem";
  ta.style.background = "var(--bg-elev-2)";
  ta.style.border = "1px solid rgba(201,160,99,.3)";
  ta.style.color = "var(--text)";
  ta.style.borderRadius = "8px";
  ta.style.padding = "8px";
  box.appendChild(ta);

  const status = document.createElement("div");
  status.className = "faint";
  status.style.margin = "6px 0";
  box.appendChild(status);

  const row = document.createElement("div");
  row.className = "row";
  const validateBtn = document.createElement("button");
  validateBtn.className = "btn btn-sm";
  validateBtn.textContent = "✓ Valida";
  const applyBtn = document.createElement("button");
  applyBtn.className = "btn btn-sm btn-primary";
  applyBtn.textContent = "Applica";
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-sm";
  saveBtn.textContent = "💾 Salva in libreria";
  row.append(validateBtn, applyBtn, saveBtn);
  box.appendChild(row);

  function parseOrNull() {
    try { return JSON.parse(ta.value); } catch (e) { status.textContent = `❌ JSON non valido: ${e.message}`; return null; }
  }
  validateBtn.addEventListener("click", () => { const j = parseOrNull(); if (j) status.textContent = "✅ JSON valido."; });
  applyBtn.addEventListener("click", () => {
    const j = parseOrNull();
    if (!j) return;
    wf.json = j;
    setActiveWorkflow(wf);
    toast("Modifiche applicate al workflow attivo.");
    renderEditor(container, navigate);
  });
  saveBtn.addEventListener("click", async () => {
    const j = parseOrNull();
    if (!j) return;
    try { await saveWorkflowToLibrary(wf.name, j); toast("Salvato in libreria."); }
    catch (e) { toast(`Bridge non raggiungibile: ${e.message}`, { error: true }); }
  });

  container.appendChild(box);
}

// ---------------- GENERA ----------------
function renderGenerate(container, navigate) {
  const wf = getActiveWorkflow();
  if (!wf) {
    container.innerHTML = `<div class="card"><h3>Nessun workflow attivo</h3><button class="btn btn-primary" id="goLib">Scegli un workflow</button></div>`;
    container.querySelector("#goLib").addEventListener("click", () => navigate("/comfy/workflows"));
    return;
  }
  container.innerHTML = `
    <div class="card">
      <h3>Riepilogo</h3>
      <p>Workflow attivo: <strong>${wf.name}</strong></p>
      <p class="faint">Formato: ${isApiFormat(wf.json) ? "API (compatibile con l'invio diretto)" : "UI — non inviabile direttamente, ri-esporta in formato API da ComfyUI"}</p>
    </div>
    <div class="row"><button class="btn btn-primary" id="genBtn" ${isApiFormat(wf.json) ? "" : "disabled"}>🚀 GENERA CON COMFYUI</button></div>
    <div id="genStatus" class="card hidden"><h3>Stato</h3><div id="genStatusBody" class="muted"></div></div>
    <div id="genResult" class="stack" style="margin-top:12px;"></div>
  `;

  container.querySelector("#genBtn").addEventListener("click", async () => {
    const statusCard = container.querySelector("#genStatus");
    const statusBody = container.querySelector("#genStatusBody");
    statusCard.classList.remove("hidden");
    statusBody.textContent = "Invio del workflow a ComfyUI...";
    try {
      const { prompt_id } = await generateWorkflow(wf.json);
      statusBody.textContent = `In coda (prompt_id: ${prompt_id}). Attendo il completamento...`;
      await pollStatus(prompt_id, statusBody, container.querySelector("#genResult"));
    } catch (e) {
      statusBody.textContent = `❌ Errore: ${e.message}`;
    }
  });
}

async function pollStatus(promptId, statusBody, resultEl) {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const status = await getGenerationStatus(promptId);
      if (status.status === "completed") {
        statusBody.textContent = "✅ Generazione completata.";
        (status.images || []).forEach((img) => {
          const url = getGeneratedImageUrl(img);
          const el = document.createElement("img");
          el.src = url;
          el.style.maxWidth = "220px";
          el.style.borderRadius = "12px";
          el.style.cursor = "zoom-in";
          el.addEventListener("click", () => openImageViewer(url, { title: "Immagine generata" }));
          resultEl.appendChild(el);
        });
        return;
      } else if (status.status === "error") {
        statusBody.textContent = `❌ Errore ComfyUI: ${status.error || "sconosciuto"}`;
        return;
      } else {
        statusBody.textContent = `⏳ ${status.status || "in elaborazione"}...`;
      }
    } catch (e) {
      statusBody.textContent = `❌ ${e.message}`;
      return;
    }
  }
  statusBody.textContent = "⏱️ Timeout in attesa del risultato.";
}
