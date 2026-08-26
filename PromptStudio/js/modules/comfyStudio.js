// ==========================================================================
// modules/comfyStudio.js — MODULO 2: COMFYUI STUDIO
//
// Technically separate from the creative Prompt Builder. Handles the Bridge
// connection, the model/node inventory, the workflow library + editor, and
// sending a generation job to the local ComfyUI server.
// ==========================================================================

import { lsGet, lsSet, getImageRecord, saveImageBlob } from "../storage.js";
import {
  getBridgeConfig, setBridgeConfig, checkHealth, pushConfigToBridge,
  fetchInventory, rescanInventory, listWorkflows, getWorkflow,
  saveWorkflowToLibrary, deleteWorkflow, generateWorkflow, getGenerationStatus,
  getGeneratedImageUrl, uploadInputImage, fetchInstalledNodeTypes,
} from "./comfyBridge.js";
import { extractParams, setNodeInput, findImageNodes, isApiFormat } from "./workflowParams.js";
import { detectFamily, compareCompatibility, badgeLabel } from "./compat.js";
import { pickImportSource, resolveImportedFile } from "../components/importSource.js";
import { pickCharacterReferenceImage } from "../components/characterImagePicker.js";
import { renderPrivacyThumb } from "../components/privacyThumb.js";
import { openImageFilterPicker } from "../components/imageFilters.js";
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
    case "editor": setHeader("ComfyUI Studio", "Editor workflow"); await renderEditor(container, navigate); break;
    case "generate": setHeader("ComfyUI Studio", "Genera"); await renderGenerate(container, navigate); break;
    default: setHeader("ComfyUI Studio", "Panoramica"); renderHub(container, navigate); break;
  }
}

function renderHub(container, navigate) {
  const bridge = getBridgeConfig();
  const wf = getActiveWorkflow();
  const proj = getProject();

  container.innerHTML = `
    <div class="card">
      <h3>Stato Bridge</h3>
      <p class="muted">${bridge.connected
        ? `🟢 Connesso — ${bridge.baseUrl}`
        : "🔴 Non connesso. Avvia AVVIA_BRIDGE.bat sul PC e configura la connessione."}</p>
    </div>
    ${nextStepBannerHtml(wf, proj)}
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

  const nextBtn = container.querySelector("#nextStepBtn");
  if (nextBtn) nextBtn.addEventListener("click", () => navigate(nextBtn.dataset.goto));
}

/**
 * Always tells the user the ONE next action, so arriving here after
 * building a character never leaves them wondering where to go: pick a
 * workflow -> put the prompt into it -> generate.
 */
function nextStepBannerHtml(wf, proj) {
  let step;
  if (!wf) {
    step = { label: "① Scegli un workflow", desc: "Nessun workflow selezionato: vai nella libreria e scegline (o importane) uno.", goto: "/comfy/workflows", cta: "Vai alla Libreria Workflow" };
  } else if (wf.filledForProjectId !== proj.id) {
    step = { label: "② Inserisci il tuo prompt nel workflow", desc: `Hai scelto "${wf.name}", ma non contiene ancora il prompt del personaggio che hai creato.`, goto: "/comfy/editor", cta: "Apri l'Editor e inserisci il prompt" };
  } else {
    step = { label: "③ Genera l'immagine", desc: `"${wf.name}" ha già il tuo prompt: sei pronto per generare.`, goto: "/comfy/generate", cta: "🚀 Vai a Genera" };
  }
  return `
    <div class="card" style="border-color:var(--gold);">
      <h3>${step.label}</h3>
      <p class="muted">${step.desc}</p>
      <button class="btn btn-primary" id="nextStepBtn" data-goto="${step.goto}">${step.cta}</button>
    </div>`;
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
async function renderEditor(container, navigate) {
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

  // Real models installed on the PC, so checkpoint/LoRA are pick-from-a-list,
  // never free-typed filenames — falls back to a text field if the Bridge
  // can't be reached right now.
  let inventory = null;
  try { inventory = await fetchInventory(); } catch (e) { inventory = null; }
  const nameOf = (it) => (typeof it === "string" ? it : it.name);
  const checkpointNames = inventory ? (inventory.checkpoints || []).map(nameOf) : null;
  const loraNames = inventory ? (inventory.loras || []).map(nameOf) : null;
  if (!inventory && (params.checkpoints.length || params.loras.length)) {
    const hint = document.createElement("p");
    hint.className = "faint";
    hint.textContent = "Bridge non raggiungibile: inserisci i nomi dei modelli a mano qui sotto invece di sceglierli da un elenco.";
    container.appendChild(hint);
  }

  if (params.checkpoints.length) {
    const box = sectionCard("Checkpoint");
    if (checkpointNames && checkpointNames.length) {
      const hint = document.createElement("p");
      hint.className = "faint";
      hint.style.marginTop = "-4px";
      hint.textContent = "Elenco raggruppato per famiglia rilevata dal nome del file — è un'euristica sul nome, non una verifica reale: i checkpoint la cui famiglia non è riconoscibile restano in \"❓ Famiglia non determinabile\", mai marcati a caso.";
      box.appendChild(hint);
    }
    params.checkpoints.forEach((c) => {
      const fam = detectFamily({ name: c.value || "" });
      const onChange = (v) => { setNodeInput(wf.json, c.nodeId, "ckpt_name", v); persist(wf); };
      const row = checkpointNames ? selectRowByFamily(c.title, c.value, checkpointNames, fam.family, onChange) : fieldRow(c.title, c.value, onChange);
      row.appendChild(compatBadge(fam));
      box.appendChild(row);
    });
    container.appendChild(box);
  }

  if (params.loras.length) {
    const box = sectionCard("LoRA");
    const ckptFam = params.checkpoints[0] ? detectFamily({ name: params.checkpoints[0].value || "" }) : null;
    if (loraNames && loraNames.length) {
      const hint = document.createElement("p");
      hint.className = "faint";
      hint.style.marginTop = "-4px";
      hint.textContent = ckptFam && ckptFam.family !== "unknown"
        ? `Elenco ordinato per compatibilità con il checkpoint rilevato (${ckptFam.family}) — i ✅ Compatibili sono quelli che puoi scegliere con più sicurezza.`
        : "Famiglia del checkpoint non determinabile: non posso ordinare per compatibilità con certezza, i LoRA restano tutti in \"❓ Da verificare\".";
      box.appendChild(hint);
    }
    params.loras.forEach((l) => {
      const onChange = (v) => { setNodeInput(wf.json, l.nodeId, "lora_name", v); persist(wf); };
      const row = loraNames ? selectRowGrouped(l.title, l.value, loraNames, ckptFam, onChange) : fieldRow(l.title, l.value, onChange);
      const famLora = detectFamily({ name: l.value || "" });
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
    const proj = getProject();
    const alreadyFilled = wf.filledForProjectId === proj.id;
    const fillHint = document.createElement("p");
    fillHint.className = "faint";
    fillHint.style.marginTop = "-4px";
    fillHint.textContent = alreadyFilled
      ? "✅ Il prompt del tuo progetto è già stato inserito qui sotto."
      : "Questo workflow ha ancora il suo testo originale. Premi il pulsante per sostituirlo con il prompt che hai creato nel percorso guidato.";
    box.appendChild(fillHint);
    params.textPrompts.forEach((p) => {
      box.appendChild(textAreaRow(`${p.title} ${p.role !== "unknown" ? `(${p.role === "positive" ? "positivo" : "negativo"})` : ""}`, p.text || "", (v) => { setNodeInput(wf.json, p.nodeId, "text", v); persist(wf); }));
    });
    const fillBtn = document.createElement("button");
    fillBtn.className = alreadyFilled ? "btn btn-sm" : "btn btn-primary";
    fillBtn.textContent = "⬇️ Riempi da Prompt Studio (Module 1)";
    fillBtn.addEventListener("click", async () => {
      params.textPrompts.forEach((p) => {
        const text = p.role === "negative" ? getNegativePrompt() : getPositivePrompt();
        setNodeInput(wf.json, p.nodeId, "text", text);
      });
      wf.filledForProjectId = proj.id;
      persist(wf);
      toast("Prompt inserito nel workflow.");
      await renderEditor(container, navigate);
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

    async function assignImageToNode(file, nodeId) {
      try {
        const { filename } = await uploadInputImage(file);
        setNodeInput(wf.json, nodeId, "image", filename);
        persist(wf);
        toast(`Immagine "${filename}" caricata nella cartella input di ComfyUI e collegata al nodo.`);
      } catch (e) {
        toast(`Bridge non raggiungibile (${e.message}): imposto solo il nome file, copiala manualmente in ComfyUI/input.`, { error: true, ms: 6000 });
        setNodeInput(wf.json, nodeId, "image", file.name);
        persist(wf);
      }
    }

    params.loadImages.forEach((li) => {
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "10px";
      wrap.innerHTML = `<div>${li.title}<br/><span class="faint">${li.value || "(nessuna)"}</span></div>`;

      const btnRow = document.createElement("div");
      btnRow.className = "row";
      btnRow.style.marginTop = "6px";

      if (p.referenceImageId) {
        const useProjectBtn = document.createElement("button");
        useProjectBtn.className = "btn btn-sm btn-primary";
        useProjectBtn.textContent = "⭐ Usa reference del progetto attuale";
        useProjectBtn.addEventListener("click", async () => {
          const rec = await getImageRecord(p.referenceImageId);
          if (!rec) { toast("Reference non trovata.", { error: true }); return; }
          const file = new File([rec.blob], `reference.${(rec.blob.type || "").split("/")[1] || "png"}`, { type: rec.blob.type });
          await assignImageToNode(file, li.nodeId);
          renderEditor(container, navigate);
        });
        btnRow.appendChild(useProjectBtn);
      }

      const fromCharBtn = document.createElement("button");
      fromCharBtn.className = "btn btn-sm";
      fromCharBtn.textContent = "📇 Da un personaggio salvato";
      fromCharBtn.addEventListener("click", async () => {
        const file = await pickCharacterReferenceImage();
        if (!file) return;
        await assignImageToNode(file, li.nodeId);
        renderEditor(container, navigate);
      });
      btnRow.appendChild(fromCharBtn);

      const fromFileBtn = document.createElement("button");
      fromFileBtn.className = "btn btn-sm";
      fromFileBtn.textContent = "📁 Assegna da file";
      fromFileBtn.addEventListener("click", async () => {
        const picked = await pickImportSource({ accept: "image/*", title: `Assegna immagine a ${li.title}` });
        if (!picked) return;
        const file = await resolveImportedFile(picked);
        await assignImageToNode(file, li.nodeId);
        renderEditor(container, navigate);
      });
      btnRow.appendChild(fromFileBtn);

      wrap.appendChild(btnRow);
      box.appendChild(wrap);
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

/** Same as fieldRow, but a dropdown of the models actually found on disk
 * (per spec: never make the user guess/type a filename). The current
 * value is always kept selectable even if the last scan didn't see it,
 * so switching workflows never silently discards it. */
function selectRow(label, value, options, onChange) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.justifyContent = "space-between";
  row.style.marginBottom = "8px";
  row.style.flexWrap = "wrap";
  const span = document.createElement("span");
  span.textContent = label;
  span.style.flex = "1 1 auto";
  const select = document.createElement("select");
  select.style.maxWidth = "220px";
  select.style.background = "var(--bg-elev-2)";
  select.style.border = "1px solid rgba(201,160,99,.3)";
  select.style.color = "var(--text)";
  select.style.borderRadius = "8px";
  select.style.padding = "6px 8px";

  const names = [...new Set(options)];
  if (value && !names.includes(value)) names.unshift(value);
  if (!names.length) names.push("");

  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name || "(nessun modello trovato — vai in Inventario)";
    if (name === value) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => onChange(select.value));
  row.appendChild(span);
  row.appendChild(select);
  return row;
}

/**
 * Like selectRow, but grouped by compatibility with `ckptFam` (the
 * detected family of the workflow's checkpoint) using <optgroup> — never
 * hides an option outright (the family detection is heuristic and can
 * miss a real match), just surfaces the ✅ compatible ones first so
 * "il verde" is the obvious, easy pick.
 */
function selectRowGrouped(label, value, options, ckptFam, onChange) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.justifyContent = "space-between";
  row.style.marginBottom = "8px";
  row.style.flexWrap = "wrap";
  const span = document.createElement("span");
  span.textContent = label;
  span.style.flex = "1 1 auto";
  const select = document.createElement("select");
  select.style.maxWidth = "220px";
  select.style.background = "var(--bg-elev-2)";
  select.style.border = "1px solid rgba(201,160,99,.3)";
  select.style.color = "var(--text)";
  select.style.borderRadius = "8px";
  select.style.padding = "6px 8px";

  const names = [...new Set(options)];
  if (value && !names.includes(value)) names.unshift(value);

  const groups = { green: [], yellow: [], red: [] };
  names.forEach((name) => {
    const level = ckptFam ? compareCompatibility(ckptFam, detectFamily({ name })).level : "yellow";
    groups[level].push(name);
  });

  [
    { level: "green", label: "✅ Compatibili" },
    { level: "yellow", label: "❓ Da verificare" },
    { level: "red", label: "⛔ Probabilmente incompatibili" },
  ].forEach(({ level, label: groupLabel }) => {
    if (!groups[level].length) return;
    const og = document.createElement("optgroup");
    og.label = groupLabel;
    groups[level].forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === value) opt.selected = true;
      og.appendChild(opt);
    });
    select.appendChild(og);
  });
  if (!names.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(nessun modello trovato — vai in Inventario)";
    select.appendChild(opt);
  }

  select.addEventListener("change", () => onChange(select.value));
  row.appendChild(span);
  row.appendChild(select);
  return row;
}

/**
 * Groups checkpoint options by their OWN detected family via <optgroup> —
 * there's no single "reference" to compare a checkpoint against (it IS
 * the family), so this clusters look-alikes together instead of dumping
 * every model in one flat alphabetical list. The family matching the
 * currently-set checkpoint (if any) is pinned first.
 */
function selectRowByFamily(label, value, options, currentFamily, onChange) {
  const row = document.createElement("div");
  row.className = "row";
  row.style.justifyContent = "space-between";
  row.style.marginBottom = "8px";
  row.style.flexWrap = "wrap";
  const span = document.createElement("span");
  span.textContent = label;
  span.style.flex = "1 1 auto";
  const select = document.createElement("select");
  select.style.maxWidth = "240px";
  select.style.background = "var(--bg-elev-2)";
  select.style.border = "1px solid rgba(201,160,99,.3)";
  select.style.color = "var(--text)";
  select.style.borderRadius = "8px";
  select.style.padding = "6px 8px";

  const names = [...new Set(options)];
  if (value && !names.includes(value)) names.unshift(value);

  const byFamily = new Map();
  names.forEach((name) => {
    const fam = detectFamily({ name }).family;
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam).push(name);
  });

  const order = [...byFamily.keys()].filter((f) => f !== "unknown").sort((a, b) => {
    if (a === currentFamily) return -1;
    if (b === currentFamily) return 1;
    return a.localeCompare(b);
  });
  if (byFamily.has("unknown")) order.push("unknown");

  order.forEach((fam) => {
    const og = document.createElement("optgroup");
    og.label = fam === "unknown" ? "❓ Famiglia non determinabile" : fam === currentFamily ? `✅ ${fam} (stessa famiglia)` : fam;
    byFamily.get(fam).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === value) opt.selected = true;
      og.appendChild(opt);
    });
    select.appendChild(og);
  });
  if (!names.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(nessun modello trovato — vai in Inventario)";
    select.appendChild(opt);
  }

  select.addEventListener("change", () => onChange(select.value));
  row.appendChild(span);
  row.appendChild(select);
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
  applyBtn.addEventListener("click", async () => {
    const j = parseOrNull();
    if (!j) return;
    wf.json = j;
    setActiveWorkflow(wf);
    toast("Modifiche applicate al workflow attivo.");
    await renderEditor(container, navigate);
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
async function renderGenerate(container, navigate) {
  const wf = getActiveWorkflow();
  if (!wf) {
    container.innerHTML = `<div class="card"><h3>Nessun workflow attivo</h3><button class="btn btn-primary" id="goLib">Scegli un workflow</button></div>`;
    container.querySelector("#goLib").addEventListener("click", () => navigate("/comfy/workflows"));
    return;
  }
  const apiFormat = isApiFormat(wf.json);
  const missingImages = apiFormat
    ? findImageNodes(wf.json).filter((n) => !n.value || !String(n.value).trim())
    : [];

  // Cross-check every node type the workflow uses against what ComfyUI has
  // actually registered (built-in + installed custom nodes) — catches a
  // missing custom node BEFORE submission instead of via a 400 from ComfyUI.
  let missingNodeTypes = [];
  let nodeCheckUnavailable = false;
  if (apiFormat) {
    try {
      const installed = new Set(await fetchInstalledNodeTypes());
      const usedTypes = new Set(Object.values(wf.json).map((n) => n.class_type).filter(Boolean));
      missingNodeTypes = [...usedTypes].filter((t) => !installed.has(t));
    } catch (e) {
      nodeCheckUnavailable = true;
    }
  }

  const blockers = missingImages.length || missingNodeTypes.length;

  container.innerHTML = `
    <div class="card">
      <h3>Riepilogo</h3>
      <p>Workflow attivo: <strong>${wf.name}</strong></p>
      <p class="faint">Formato: ${apiFormat ? "API (compatibile con l'invio diretto)" : "UI — non inviabile direttamente, ri-esporta in formato API da ComfyUI"}</p>
      ${nodeCheckUnavailable ? `<p class="faint">Bridge/ComfyUI non raggiungibile: non posso controllare in anticipo se mancano custom node installati.</p>` : ""}
    </div>
    ${missingNodeTypes.length ? `
    <div class="card" style="border-color:rgba(217,83,79,.5);">
      <h3 style="color:var(--red);">⚠️ Nodi non installati</h3>
      <p class="muted">Questo workflow usa dei nodi che non risultano installati in ComfyUI (probabilmente custom node mancanti). Installali con ComfyUI Manager (o manualmente) e riavvia ComfyUI, altrimenti la generazione verrà rifiutata:</p>
      <ul style="margin:8px 0;padding-left:20px;">
        ${missingNodeTypes.map((t) => `<li>${t}</li>`).join("")}
      </ul>
    </div>` : ""}
    ${missingImages.length ? `
    <div class="card" style="border-color:rgba(217,83,79,.5);">
      <h3 style="color:var(--red);">⚠️ Immagini mancanti</h3>
      <p class="muted">Questi nodi "Load Image" non hanno un file assegnato. Se generi comunque, ComfyUI molto probabilmente darà errore (non trova nessuna immagine da caricare):</p>
      <ul style="margin:8px 0;padding-left:20px;">
        ${missingImages.map((n) => `<li>${n.title}</li>`).join("")}
      </ul>
      <button class="btn btn-primary" id="goFixImages">🖼️ Vai all'editor per assegnarle</button>
    </div>` : ""}
    <div class="row">
      <button class="btn btn-primary" id="genBtn" ${apiFormat ? "" : "disabled"}>🚀 GENERA CON COMFYUI</button>
      ${blockers ? `<button class="btn btn-sm" id="genAnyway">Genera comunque, ignora l'avviso</button>` : ""}
    </div>
    <div id="genStatus" class="card hidden"><h3>Stato</h3><div id="genStatusBody" class="muted"></div></div>
    <div id="genResult" class="stack" style="margin-top:12px;"></div>
  `;

  if (missingImages.length) {
    container.querySelector("#goFixImages").addEventListener("click", () => navigate("/comfy/editor"));
  }
  if (blockers) {
    container.querySelector("#genBtn").disabled = true;
    container.querySelector("#genAnyway").addEventListener("click", () => {
      container.querySelector("#genBtn").disabled = false;
      container.querySelector("#genAnyway").remove();
    });
  }

  container.querySelector("#genBtn").addEventListener("click", async () => {
    const statusCard = container.querySelector("#genStatus");
    const statusBody = container.querySelector("#genStatusBody");
    statusCard.classList.remove("hidden");
    statusBody.textContent = "Invio del workflow a ComfyUI...";
    try {
      const { prompt_id } = await generateWorkflow(wf.json);
      statusBody.textContent = `In coda (prompt_id: ${prompt_id}). Attendo il completamento...`;
      await pollStatus(prompt_id, statusBody, container.querySelector("#genResult"), wf.name);
    } catch (e) {
      statusBody.textContent = `❌ Errore: ${e.message}`;
    }
  });
}

async function pollStatus(promptId, statusBody, resultEl, workflowName) {
  let consecutiveFailures = 0;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const status = await getGenerationStatus(promptId);
      consecutiveFailures = 0;
      if (status.status === "completed") {
        const images = status.images || [];
        statusBody.textContent = images.length
          ? "✅ Generazione completata. Salvo le immagini in Archivio..."
          : "✅ Generazione completata.";
        for (const img of images) {
          const holder = document.createElement("div");
          holder.style.display = "inline-block";
          resultEl.appendChild(holder);
          try {
            const url = getGeneratedImageUrl(img);
            const blob = await (await fetch(url)).blob();
            const imageId = await saveImageBlob(blob, { kind: "generated", workflowName: workflowName || "", filename: img.filename });
            const thumbSlot = document.createElement("div");
            holder.appendChild(thumbSlot);
            await renderPrivacyThumb(thumbSlot, imageId, { title: "Immagine generata", size: "220px" });
            const filterBtn = document.createElement("button");
            filterBtn.type = "button";
            filterBtn.className = "btn filter-btn";
            filterBtn.style.marginTop = "6px";
            filterBtn.textContent = "🎨 Filtri";
            filterBtn.addEventListener("click", () => {
              openImageFilterPicker(imageId, {
                onSaved: async (newImageId) => {
                  const newHolder = document.createElement("div");
                  newHolder.style.display = "inline-block";
                  newHolder.style.marginLeft = "8px";
                  resultEl.appendChild(newHolder);
                  await renderPrivacyThumb(newHolder, newImageId, { title: "Immagine filtrata", size: "220px" });
                },
              });
            });
            holder.appendChild(filterBtn);
          } catch (e) {
            // Couldn't save into the app's own gallery (e.g. Bridge hiccup
            // mid-fetch) — still show it live from ComfyUI so the user
            // isn't left with nothing, just without the privacy eye.
            const url = getGeneratedImageUrl(img);
            const el = document.createElement("img");
            el.src = url;
            el.style.maxWidth = "220px";
            el.style.borderRadius = "12px";
            el.style.cursor = "zoom-in";
            el.addEventListener("click", () => openImageViewer(url, { title: "Immagine generata" }));
            holder.appendChild(el);
            toast(`Immagine mostrata ma non salvata in Archivio: ${e.message}`, { error: true });
          }
        }
        statusBody.textContent = images.length ? "✅ Generazione completata e salvata in Archivio → Immagini." : "✅ Generazione completata.";
        return;
      } else if (status.status === "error") {
        statusBody.textContent = `❌ Errore ComfyUI: ${status.error || "sconosciuto"}`;
        return;
      } else {
        statusBody.textContent = `⏳ ${status.status || "in elaborazione"}...`;
      }
    } catch (e) {
      consecutiveFailures++;
      // A single hiccup talking to the Bridge shouldn't abort tracking a
      // job that's likely still running fine — only give up after a run
      // of real failures in a row.
      if (consecutiveFailures >= 5) {
        statusBody.textContent = `❌ ${e.message}`;
        return;
      }
      statusBody.textContent = `⏳ In elaborazione (Bridge momentaneamente lento a rispondere: ${e.message})...`;
    }
  }
  statusBody.textContent = "⏱️ Timeout in attesa del risultato.";
}
