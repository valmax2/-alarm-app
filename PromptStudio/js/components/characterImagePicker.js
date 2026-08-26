// ==========================================================================
// components/characterImagePicker.js — "carica da Archivio personaggio":
// the fastest way to feed a Load Image node is usually a reference you
// already set up for a character, not re-browsing the filesystem.
// ==========================================================================

import { getCharacters } from "../modules/gallery.js";
import { getImageRecord } from "../storage.js";
import { renderPrivacyThumb } from "./privacyThumb.js";

/** Resolves to a File (built from the chosen image's stored blob) or null. */
export function pickCharacterReferenceImage() {
  return new Promise((resolve) => {
    const characters = getCharacters();

    const overlay = document.createElement("div");
    overlay.className = "image-viewer-overlay";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "520px";
    card.style.width = "94vw";
    card.style.maxHeight = "80vh";
    card.style.overflowY = "auto";
    card.innerHTML = `<h3>Carica da Archivio personaggio</h3>`;

    if (!characters.length) {
      card.innerHTML += `<p class="muted">Non hai ancora nessun personaggio salvato in Archivio.</p>`;
    }

    const list = document.createElement("div");
    list.className = "stack";
    card.appendChild(list);

    const cancelRow = document.createElement("div");
    cancelRow.className = "row";
    cancelRow.style.cssText = "justify-content:flex-end;margin-top:14px;";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn";
    cancelBtn.textContent = "Annulla";
    cancelRow.appendChild(cancelBtn);
    card.appendChild(cancelRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function finish(result) { overlay.remove(); resolve(result); }
    cancelBtn.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(null); });

    characters.forEach((c) => {
      const slots = [
        { label: "Foto principale", imageId: c.mainImageId },
        ...c.referencePack.filter((s) => s.imageId).map((s) => ({ label: s.label, imageId: s.imageId })),
      ].filter((s) => s.imageId);
      if (!slots.length) return;

      const charCard = document.createElement("div");
      charCard.className = "card";
      charCard.innerHTML = `<h3 style="font-size:.95rem;">${c.name}</h3>`;
      const grid = document.createElement("div");
      grid.className = "thumb-grid";
      charCard.appendChild(grid);

      slots.forEach(async (slot) => {
        const holder = document.createElement("div");
        holder.style.cursor = "pointer";
        holder.addEventListener("click", async () => {
          const rec = await getImageRecord(slot.imageId);
          if (!rec) return;
          const ext = (rec.blob.type && rec.blob.type.split("/")[1]) || "png";
          const safeName = `${c.name}_${slot.label}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
          const file = new File([rec.blob], `${safeName}.${ext}`, { type: rec.blob.type || "image/png" });
          finish(file);
        });
        grid.appendChild(holder);
        const lbl = document.createElement("div");
        lbl.style.cssText = "position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);font-size:.68rem;padding:2px 3px;color:#fff;";
        lbl.textContent = slot.label;
        await renderPrivacyThumb(holder, slot.imageId, { title: `${c.name} — ${slot.label}`, zoomable: false, overlay: lbl });
      });

      list.appendChild(charCard);
    });
  });
}
