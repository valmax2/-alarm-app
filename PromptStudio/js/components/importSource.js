// ==========================================================================
// importSource.js — the universal "Importa" picker.
//
// Per spec this same 3-way choice must appear everywhere something is
// imported (character photos, reference, workflow JSON, presets, inventory
// files...):
//   1) GESTORE FILE / CLOUD  -> native OS/browser file picker (on Android
//      this surfaces Drive/OneDrive/Dropbox/etc. automatically — the app
//      never asks for cloud passwords, it just delegates to the OS).
//   2) PC — CARTELLA COMFYUI -> browse via the local Bridge, rooted at the
//      configured ComfyUI folder.
//   3) PC — I MIEI FILE      -> browse via the local Bridge, rooted at the
//      configured personal-files folder.
//
// Bridge-backed sources are only offered when a Bridge connection is
// configured (see comfyBridge.js); otherwise only the native picker shows.
// ==========================================================================

import { getBridgeConfig, bridgeBrowse, bridgeFetchFile, getBridgeFileUrl } from "../modules/comfyBridge.js";
import { toast } from "./toast.js";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;

/**
 * Opens the universal import chooser.
 * @param {object} opts
 * @param {string} [opts.accept] - accept attribute for native picker (e.g. "image/*", ".json,.txt")
 * @param {string} [opts.title]
 * @returns {Promise<{source:string, file?:File, bridgePath?:string, name:string}|null>}
 */
export function pickImportSource({ accept = "*/*", title = "Importa" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "image-viewer-overlay";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "420px";
    card.style.width = "92vw";
    card.innerHTML = `<h3>${title}</h3><div class="import-sources"></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px;">
        <button class="btn" id="impCancel">Annulla</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function finish(result) {
      overlay.remove();
      resolve(result);
    }

    card.querySelector("#impCancel").addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(null); });

    const list = card.querySelector(".import-sources");

    // Source 1: native picker (covers device storage + cloud providers on Android)
    const nativeBtn = document.createElement("button");
    nativeBtn.className = "import-source-btn";
    nativeBtn.innerHTML = `<span class="ico">📁</span><span><strong>Gestore file / Cloud</strong><br><span class="faint">Memoria del dispositivo, Drive, OneDrive, Dropbox…</span></span>`;
    nativeBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (file) finish({ source: "native", file, name: file.name });
        else finish(null);
      });
      input.click();
    });
    list.appendChild(nativeBtn);

    const bridge = getBridgeConfig();

    // Source 2: ComfyUI folder via Bridge
    const comfyBtn = document.createElement("button");
    comfyBtn.className = "import-source-btn";
    comfyBtn.innerHTML = `<span class="ico">🧩</span><span><strong>PC — cartella ComfyUI</strong><br><span class="faint">${bridge.comfyRoot ? bridge.comfyRoot : "Bridge non configurato"}</span></span>`;
    comfyBtn.disabled = !bridge.connected || !bridge.comfyRoot;
    if (comfyBtn.disabled) comfyBtn.style.opacity = ".45";
    comfyBtn.addEventListener("click", async () => {
      if (comfyBtn.disabled) { toast("Configura prima il Bridge in ComfyUI Studio", { error: true }); return; }
      const picked = await browseBridgeFolder("comfy");
      if (picked) finish({ source: "bridge", bridgeRoot: "comfy", bridgePath: picked.path, name: picked.name });
      else finish(null);
    });
    list.appendChild(comfyBtn);

    // Source 3: personal folder via Bridge
    const personalBtn = document.createElement("button");
    personalBtn.className = "import-source-btn";
    personalBtn.innerHTML = `<span class="ico">🗂️</span><span><strong>PC — i miei file</strong><br><span class="faint">${bridge.personalRoot ? bridge.personalRoot : "Cartella personale non configurata"}</span></span>`;
    personalBtn.disabled = !bridge.connected || !bridge.personalRoot;
    if (personalBtn.disabled) personalBtn.style.opacity = ".45";
    personalBtn.addEventListener("click", async () => {
      if (personalBtn.disabled) { toast("Configura prima la cartella personale nel Bridge", { error: true }); return; }
      const picked = await browseBridgeFolder("personal");
      if (picked) finish({ source: "bridge", bridgeRoot: "personal", bridgePath: picked.path, name: picked.name });
      else finish(null);
    });
    list.appendChild(personalBtn);

    // Source 4: paste text directly — the fallback that always works, no
    // OS file picker involved at all. Only offered for text-ish imports
    // (JSON, txt), not for photo uploads. This is the one option that
    // still works even somewhere a native/cloud file picker can't open
    // (e.g. a sandboxed preview page) — you copy the file's content
    // elsewhere and paste it in here instead of picking the file itself.
    if (!accept.includes("image")) {
      const pasteBtn = document.createElement("button");
      pasteBtn.type = "button";
      pasteBtn.className = "import-source-btn";
      pasteBtn.innerHTML = `<span class="ico">📋</span><span><strong>Incolla testo</strong><br><span class="faint">Copia il contenuto del file e incollalo qui — funziona sempre, anche se il selettore file non si apre</span></span>`;
      pasteBtn.addEventListener("click", () => {
        card.innerHTML = `<h3>${title}</h3>
          <p class="faint" style="margin-top:-4px;">Incolla qui sotto il contenuto del file (es. il JSON del workflow).</p>
          <textarea id="pasteArea" rows="10" style="width:100%;font-family:monospace;font-size:.85rem;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(201,160,99,.25);border-radius:var(--radius-md);padding:10px;"></textarea>
          <div class="row" style="justify-content:flex-end;margin-top:14px;gap:8px;">
            <button class="btn" id="pasteBack">Indietro</button>
            <button class="btn btn-primary" id="pasteConfirm">Importa</button>
          </div>`;
        card.querySelector("#pasteBack").addEventListener("click", () => finish(null));
        card.querySelector("#pasteConfirm").addEventListener("click", () => {
          const text = card.querySelector("#pasteArea").value;
          if (!text || !text.trim()) { toast("Incolla prima del testo.", { error: true }); return; }
          finish({ source: "paste", text, name: "incollato.json" });
        });
      });
      list.appendChild(pasteBtn);
    }
  });
}

/**
 * Small folder-browser dialog backed by the Bridge's /browse endpoint.
 * Image files get a small inline thumbnail plus a larger preview that
 * appears beside the dialog on hover — otherwise a filename alone doesn't
 * tell you what you're about to pick.
 */
async function browseBridgeFolder(root) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "image-viewer-overlay";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "480px";
    card.style.width = "94vw";
    card.style.maxHeight = "80vh";
    card.style.overflowY = "auto";
    card.innerHTML = `<h3>Sfoglia (${root === "comfy" ? "ComfyUI" : "file personali"})</h3>
      <div id="browsePath" class="faint" style="margin-bottom:8px;"></div>
      <div id="browseList" class="stack"></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px;">
        <button class="btn" id="browseCancel">Annulla</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Hover-preview panel, docked beside the dialog when there's room on screen.
    const canShowSidePreview = window.innerWidth >= 900;
    let previewPanel = null;
    let positionPreview = null;
    if (canShowSidePreview) {
      previewPanel = document.createElement("div");
      previewPanel.className = "card browse-preview-panel";
      previewPanel.style.cssText = "position:fixed;top:50%;transform:translateY(-50%);width:min(320px,32vw);padding:10px;display:none;z-index:310;";
      previewPanel.innerHTML = `<img style="width:100%;border-radius:10px;display:block;"/><div class="faint" style="margin-top:6px;word-break:break-all;"></div>`;
      document.body.appendChild(previewPanel);

      positionPreview = function () {
        const cardRect = card.getBoundingClientRect();
        const spaceRight = window.innerWidth - cardRect.right;
        const spaceLeft = cardRect.left;
        if (spaceRight >= 300) {
          previewPanel.style.left = (cardRect.right + 12) + "px";
          previewPanel.style.right = "";
        } else if (spaceLeft >= 300) {
          previewPanel.style.right = (window.innerWidth - cardRect.left + 12) + "px";
          previewPanel.style.left = "";
        } else {
          previewPanel.style.display = "none";
        }
      }
      // The dialog is centered and doesn't move once open, so position once.
      positionPreview();
      window.addEventListener("resize", positionPreview);
    }

    function showPreview(url, name) {
      if (!previewPanel) return;
      previewPanel.querySelector("img").src = url;
      previewPanel.querySelector(".faint").textContent = name;
      previewPanel.style.display = "block";
    }
    function hidePreview() {
      if (previewPanel) previewPanel.style.display = "none";
    }

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    card.querySelector("#browseCancel").addEventListener("click", () => close(null));

    function close(result) {
      overlay.remove();
      if (previewPanel) previewPanel.remove();
      if (positionPreview) window.removeEventListener("resize", positionPreview);
      resolve(result);
    }

    async function render(path) {
      card.querySelector("#browsePath").textContent = "/" + path;
      const listEl = card.querySelector("#browseList");
      listEl.innerHTML = "Caricamento…";
      hidePreview();
      try {
        const entries = await bridgeBrowse(root, path);
        listEl.innerHTML = "";
        if (path) {
          const up = document.createElement("button");
          up.className = "import-source-btn";
          up.innerHTML = `<span class="ico">⬅️</span> ..`;
          up.addEventListener("click", () => render(path.split("/").slice(0, -1).join("/")));
          listEl.appendChild(up);
        }
        entries.forEach((entry) => {
          const fullPath = (path ? path + "/" : "") + entry.name;
          const isImage = entry.type === "file" && IMAGE_EXT.test(entry.name);
          const btn = document.createElement("button");
          btn.className = "import-source-btn";

          if (isImage) {
            const fileUrl = getBridgeFileUrl(root, fullPath);
            btn.innerHTML = `<img src="${fileUrl}" loading="lazy" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex:0 0 auto;"/><span>${entry.name}</span>`;
            btn.addEventListener("mouseenter", () => showPreview(fileUrl, entry.name));
            btn.addEventListener("mouseleave", hidePreview);
          } else {
            btn.innerHTML = `<span class="ico">${entry.type === "dir" ? "📁" : "📄"}</span> ${entry.name}`;
          }

          btn.addEventListener("click", () => {
            if (entry.type === "dir") render(fullPath);
            else close({ path: fullPath, name: entry.name });
          });
          listEl.appendChild(btn);
        });
        if (!entries.length) listEl.innerHTML = `<span class="faint">Cartella vuota</span>`;
      } catch (e) {
        listEl.innerHTML = `<span class="faint">Impossibile leggere la cartella: ${e.message}</span>`;
      }
    }
    render("");
  });
}

/** Resolves any pickImportSource() result down to a usable File/Blob object. */
export async function resolveImportedFile(result) {
  if (!result) return null;
  if (result.source === "native") return result.file;
  if (result.source === "bridge") {
    return bridgeFetchFile(result.bridgeRoot, result.bridgePath);
  }
  if (result.source === "paste") {
    return new File([result.text], result.name || "incollato.json", { type: "application/json" });
  }
  return null;
}
