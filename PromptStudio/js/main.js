// ==========================================================================
// main.js — router + app shell wiring.
//
// Hash-based routing keeps things simple (no build step needed, works from
// file:// or any static server) and gives free back-button support, which
// matters for "always know where you are" on mobile.
//
// Routes:
//   #/home
//   #/builder/<step>        Module 1 — Crea personaggio/prompt
//   #/comfy[/<sub>]          Module 2 — ComfyUI Studio
//   #/ai                     Module 3 — Genera con IA esterne
//   #/gallery[/<sub>]        Archivio
// ==========================================================================

import * as home from "./modules/home.js";
import * as promptBuilder from "./modules/promptBuilder.js";
import * as comfyStudio from "./modules/comfyStudio.js";
import * as aiExternal from "./modules/aiExternal.js";
import * as gallery from "./modules/gallery.js";

const mainView = document.getElementById("mainView");
const promptBarEl = document.getElementById("promptBar");
const topbarTitle = document.getElementById("topbarTitle");
const topbarSubtitle = document.getElementById("topbarSubtitle");

document.getElementById("btnHome").addEventListener("click", () => navigate("/home"));
document.getElementById("btnGallery").addEventListener("click", () => navigate("/gallery"));

export function navigate(path) {
  location.hash = "#" + path;
}

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/home";
  const [path, ...rest] = raw.split("/").filter(Boolean);
  return { path: path || "home", params: rest };
}

function setHeader(title, subtitle = "") {
  topbarTitle.textContent = title;
  topbarSubtitle.textContent = subtitle;
}

function showPromptBar(show) {
  promptBarEl.classList.toggle("hidden", !show);
}

async function route() {
  const { path, params } = parseHash();
  mainView.scrollTo?.(0, 0);
  window.scrollTo(0, 0);

  try {
    switch (path) {
      case "home":
        showPromptBar(false);
        setHeader("Prompt Studio", "");
        await home.render(mainView, params, { navigate });
        break;
      case "builder":
        showPromptBar(true);
        setHeader("Crea personaggio / prompt", "");
        await promptBuilder.render(mainView, params, { navigate, setHeader, promptBarEl });
        break;
      case "comfy":
        showPromptBar(false);
        setHeader("ComfyUI Studio", "");
        await comfyStudio.render(mainView, params, { navigate, setHeader });
        break;
      case "ai":
        showPromptBar(false);
        setHeader("Genera con IA", "");
        await aiExternal.render(mainView, params, { navigate, setHeader });
        break;
      case "gallery":
        showPromptBar(false);
        setHeader("Archivio", "");
        await gallery.render(mainView, params, { navigate, setHeader });
        break;
      default:
        navigate("/home");
    }
  } catch (err) {
    console.error("Routing error", err);
    mainView.innerHTML = `<div class="card"><h3>Si è verificato un errore</h3><p class="muted">${err.message}</p></div>`;
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
if (document.readyState !== "loading") route();
