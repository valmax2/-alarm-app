// ==========================================================================
// modules/aiExternal.js — MODULO 3: GENERA CON IA ESTERNE
//
// ChatGPT, Gemini e Meta AI have no public image-generation API this app is
// authorized to call, so — per spec — we never fake an integration: we
// adapt the prompt into readable text, offer COPY, remind the user to
// attach the same reference photo on the platform, and open the official
// web app. The system stays ready for a real API integration later.
// ==========================================================================

import { getProject, getPositivePrompt, getNegativePrompt, setAiModificationNote } from "../state.js";
import { getImageUrl } from "../storage.js";
import { renderPrivacyThumb } from "../components/privacyThumb.js";
import { toast } from "../components/toast.js";

const PLATFORMS = [
  {
    id: "chatgpt", label: "ChatGPT", ico: "💬",
    url: "https://chatgpt.com/",
    note: "Incolla il testo e allega la stessa foto di riferimento nella chat.",
  },
  {
    id: "gemini", label: "Gemini", ico: "🔷",
    url: "https://gemini.google.com/",
    note: "Incolla il testo e allega la stessa foto di riferimento nella chat.",
  },
  {
    id: "metaai", label: "Meta AI", ico: "♾️",
    url: "https://www.meta.ai/",
    note: "Incolla il testo e allega la stessa foto di riferimento, se la piattaforma lo consente.",
  },
];

/**
 * Turns the comma-separated tag prompt into a readable natural-language
 * brief. When `modNote` is set, this is framed as a MODIFICATION request
 * on an existing character (e.g. "make her fuller-figured", "give me a
 * full-body shot") instead of a from-scratch generation — for taking a
 * character already built here out to an external AI to iterate on it.
 */
function toNaturalLanguage(positive, negative, modNote) {
  const subjectMap = { "1woman": "una donna", "1man": "un uomo" };
  let tags = positive.split(",").map((t) => t.trim()).filter(Boolean);
  let subject = "un personaggio";
  if (tags[0] && subjectMap[tags[0]]) { subject = subjectMap[tags[0]]; tags = tags.slice(1); }

  let text;
  if (modNote && modNote.trim()) {
    text = `Ecco la descrizione di ${subject} che ho già creato (vedi anche la foto di riferimento allegata, se presente):\n\n`;
    if (tags.length) text += `${tags.join(", ")}.\n\n`;
    text += `Partendo da questa base, vorrei questa modifica: ${modNote.trim()}.\n`;
  } else {
    text = `Genera un'immagine fotorealistica di ${subject}.\n\n`;
    if (tags.length) text += `Dettagli: ${tags.join(", ")}.\n\n`;
  }
  if (negative && negative.trim()) text += `Evita: ${negative}.\n`;
  return text.trim();
}

export async function render(container, params, { navigate }) {
  const p = getProject();
  const positive = getPositivePrompt();
  const negative = getNegativePrompt();

  container.innerHTML = `
    <div class="card">
      <h3>🎯 Vuoi chiedere una modifica specifica? (opzionale)</h3>
      <p class="faint" style="margin-top:-4px;">Es. "rendila più formosa", "dammi una foto a figura intera", "cambia l'espressione in un sorriso". Se lo scrivi, il testo qui sotto viene preparato come richiesta di modifica sul personaggio che hai già creato, non come generazione da zero.</p>
      <textarea id="modNote" rows="2" style="width:100%;font-family:inherit;font-size:.9rem;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(201,160,99,.25);border-radius:var(--radius-md);padding:10px;" placeholder="Cosa vuoi modificare?"></textarea>
    </div>
    <div class="card">
      <h3>Testo pronto per l'IA esterna</h3>
      <p class="faint">ChatGPT, Gemini e Meta AI non hanno un'integrazione automatica in questa app: copia il testo e incollalo nella chat della piattaforma che scegli.</p>
      <div class="prompt-box" id="naturalBox" contenteditable="true"></div>
      <div class="row" style="margin-top:10px;">
        <button class="btn btn-primary" id="copyNatural">📋 Copia testo</button>
        <button class="btn" id="copyRaw">📋 Copia anche il prompt tecnico</button>
      </div>
    </div>
    <div id="refCard"></div>
    <div class="card">
      <h3>Dove vuoi aprire l'IA?</h3>
      <div class="dest-grid" id="platGrid"></div>
    </div>
  `;

  const naturalBox = container.querySelector("#naturalBox");
  const modNoteEl = container.querySelector("#modNote");
  modNoteEl.value = p.aiModificationNote || "";
  let userEditedBox = false;
  function refreshNaturalText() {
    if (userEditedBox) return; // don't clobber a hand-edit the user just made
    naturalBox.textContent = toNaturalLanguage(positive, negative, modNoteEl.value);
  }
  refreshNaturalText();
  modNoteEl.addEventListener("input", () => {
    setAiModificationNote(modNoteEl.value);
    refreshNaturalText();
  });
  naturalBox.addEventListener("input", () => { userEditedBox = true; });

  container.querySelector("#copyNatural").addEventListener("click", () => copyText(naturalBox.textContent));
  container.querySelector("#copyRaw").addEventListener("click", () =>
    copyText(`${naturalBox.textContent}\n\n---\nPrompt tecnico (per generatori basati su tag):\nPOSITIVO: ${positive}\nNEGATIVO: ${negative}`));

  const refCard = container.querySelector("#refCard");
  if (p.referenceImageId) {
    refCard.className = "card";
    refCard.innerHTML = `<h3>📷 Foto di riferimento</h3><p class="faint">Allega questa stessa foto sulla piattaforma per mantenere la stessa identità.</p>`;

    const thumbHolder = document.createElement("div");
    thumbHolder.style.display = "inline-block";
    refCard.appendChild(thumbHolder);
    await renderPrivacyThumb(thumbHolder, p.referenceImageId, { title: "Foto di riferimento", size: "160px" });

    const url = await getImageUrl(p.referenceImageId);
    const dl = document.createElement("a");
    dl.href = url;
    dl.download = "reference.jpg";
    dl.className = "btn btn-sm";
    dl.textContent = "⬇️ Scarica foto";
    dl.style.marginLeft = "10px";
    refCard.appendChild(dl);
  }

  const grid = container.querySelector("#platGrid");
  PLATFORMS.forEach((plat) => {
    const btn = document.createElement("div");
    btn.className = "big-choice";
    btn.innerHTML = `<div class="ico">${plat.ico}</div><div class="title">${plat.label}</div><div class="desc">${plat.note}</div>`;
    btn.addEventListener("click", async () => {
      await copyText(naturalBox.textContent);
      window.open(plat.url, "_blank", "noopener");
    });
    grid.appendChild(btn);
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiato negli appunti.");
  } catch (e) {
    toast("Impossibile copiare automaticamente. Seleziona e copia manualmente.", { error: true });
  }
}
