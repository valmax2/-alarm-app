// ==========================================================================
// components/customOptionDialog.js — "aggiungi un pulsante tuo" a una
// categoria: campo italiano (con 🎙 dettatura + 🗑 cancella, come ogni altro
// campo dell'app), traduzione automatica in inglese al momento della
// creazione, con possibilità di correggerla a mano.
// ==========================================================================

import { buildDictationRow } from "./voice.js";
import { translateItToEn } from "./translate.js";

/** Resolves to {label, frag} or null if cancelled. */
export function openCustomOptionDialog({ categoryName }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "image-viewer-overlay";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "420px";
    card.style.width = "92vw";
    card.innerHTML = `
      <h3>Aggiungi a "${categoryName}"</h3>
      <p class="faint">Scrivi o detta in italiano: creo io il pulsante, tradotto in inglese per il prompt.</p>
      <div class="faint" style="margin-bottom:4px;">Italiano</div>
    `;

    const itInput = document.createElement("input");
    itInput.type = "text";
    itInput.placeholder = "Es. capelli bianchi";
    const itRow = buildDictationRow(itInput, () => {});
    card.appendChild(itRow);

    const enWrap = document.createElement("div");
    enWrap.style.marginTop = "10px";
    enWrap.innerHTML = `<div class="faint" style="margin-bottom:4px;">Inglese (per il prompt)</div>`;
    const enInput = document.createElement("input");
    enInput.type = "text";
    enInput.placeholder = "(tradotto automaticamente alla creazione)";
    enInput.style.cssText = "width:100%;background:var(--bg-elev-2);border:1px solid rgba(201,160,99,.3);color:var(--text);border-radius:8px;padding:9px 10px;font-size:.9rem;";
    enWrap.appendChild(enInput);
    card.appendChild(enWrap);

    const status = document.createElement("div");
    status.className = "faint";
    status.style.cssText = "margin-top:8px;min-height:16px;";
    card.appendChild(status);

    const btnRow = document.createElement("div");
    btnRow.className = "row";
    btnRow.style.cssText = "justify-content:flex-end;margin-top:14px;";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn";
    cancelBtn.textContent = "Annulla";
    const okBtn = document.createElement("button");
    okBtn.className = "btn btn-primary";
    okBtn.textContent = "➕ Crea pulsante";
    btnRow.append(cancelBtn, okBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    itInput.focus();

    function finish(v) { overlay.remove(); resolve(v); }
    cancelBtn.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(null); });
    itInput.addEventListener("keydown", (e) => { if (e.key === "Escape") finish(null); });

    okBtn.addEventListener("click", async () => {
      const itText = itInput.value.trim();
      if (!itText) { status.textContent = "Scrivi prima qualcosa in italiano (anche dettandolo)."; return; }

      let enText = enInput.value.trim();
      if (!enText) {
        okBtn.disabled = true;
        status.textContent = "Traduzione in corso...";
        const translated = await translateItToEn(itText);
        okBtn.disabled = false;
        if (translated) {
          enText = translated;
        } else {
          status.textContent = "Traduzione automatica non riuscita: scrivi tu l'inglese qui sopra e premi di nuovo.";
          enInput.placeholder = "Scrivi qui l'inglese";
          enInput.focus();
          return;
        }
      }
      finish({ label: itText, frag: enText });
    });
  });
}
