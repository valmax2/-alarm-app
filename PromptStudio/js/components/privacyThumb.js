// ==========================================================================
// components/privacyThumb.js — the ONE place that renders "a photo with an
// eye toggle". The hidden/shown state lives on the image itself
// (storage.js's setImageHidden/isImageHidden, persisted in IndexedDB), so
// hiding an image here hides it everywhere else it's shown, and it stays
// hidden the next time any screen is reopened.
// ==========================================================================

import { getImageRecord, getImageUrl, setImageHidden } from "../storage.js";
import { openImageViewer } from "./imageViewer.js";

/**
 * Renders into `container` (cleared first). Call again after external
 * changes if needed — it always re-reads the current hidden state.
 * @param {HTMLElement} container
 * @param {string|null} imageId
 * @param {{title?:string, size?:string, overlay?:HTMLElement, zoomable?:boolean}} [opts]
 *   `overlay` — an extra element (e.g. a caption label) appended onto the
 *   generated `.thumb`, shown in both the visible and hidden states.
 *   `zoomable` (default true) — set false when the thumb sits inside its
 *   own click target (e.g. a card that navigates elsewhere) so a click on
 *   the image doesn't also pop the fullscreen viewer.
 */
export async function renderPrivacyThumb(container, imageId, { title = "", size, overlay, zoomable = true } = {}) {
  container.innerHTML = "";
  if (!imageId) {
    container.innerHTML = `<span class="faint">Nessuna foto.</span>`;
    return;
  }

  const rec = await getImageRecord(imageId);
  if (!rec) {
    container.innerHTML = `<span class="faint">Foto non trovata.</span>`;
    return;
  }
  const hidden = !!(rec.meta && rec.meta.hidden);

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  if (size) thumb.style.width = size;

  if (hidden) {
    thumb.innerHTML = `<div class="hidden-overlay">🔒</div>`;
  } else {
    const url = URL.createObjectURL(rec.blob);
    const img = document.createElement("img");
    img.src = url;
    if (zoomable) {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", () => openImageViewer(url, { title }));
    }
    thumb.appendChild(img);
  }

  const eye = document.createElement("div");
  eye.className = "eye-toggle";
  eye.title = hidden ? "Mostra foto" : "Nascondi foto";
  eye.textContent = hidden ? "🙈" : "👁️";
  eye.addEventListener("click", async (e) => {
    e.stopPropagation();
    await setImageHidden(imageId, !hidden);
    renderPrivacyThumb(container, imageId, { title, size, overlay, zoomable });
  });
  thumb.appendChild(eye);

  if (overlay) thumb.appendChild(overlay);

  container.appendChild(thumb);
}
