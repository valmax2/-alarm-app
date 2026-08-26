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

import { getBridgeConfig, bridgeBrowse, bridgeFetchFile } from "../modules/comfyBridge.js";
import { toast } from "./toast.js";

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
  });
}

/** Small folder-browser dialog backed by the Bridge's /browse endpoint. */
async function browseBridgeFolder(root) {
  let currentPath = "";
  return new Promise(async (resolve) => {
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
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    card.querySelector("#browseCancel").addEventListener("click", () => close(null));

    function close(result) { overlay.remove(); resolve(result); }

    async function render(path) {
      currentPath = path;
      card.querySelector("#browsePath").textContent = "/" + path;
      const listEl = card.querySelector("#browseList");
      listEl.innerHTML = "Caricamento…";
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
          const btn = document.createElement("button");
          btn.className = "import-source-btn";
          btn.innerHTML = `<span class="ico">${entry.type === "dir" ? "📁" : "📄"}</span> ${entry.name}`;
          btn.addEventListener("click", () => {
            if (entry.type === "dir") render((path ? path + "/" : "") + entry.name);
            else close({ path: (path ? path + "/" : "") + entry.name, name: entry.name });
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
  return null;
}
