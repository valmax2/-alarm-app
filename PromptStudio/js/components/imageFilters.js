// ==========================================================================
// components/imageFilters.js — post-processing "look" filters for generated
// images, so the render feels less flat/artificial. Pure client-side
// (canvas), no ComfyUI re-generation needed: pick a filter, preview it live,
// then "bake" it into a brand-new image saved in the archive — the original
// is never touched.
// ==========================================================================

import { getImageRecord, saveImageBlob } from "../storage.js";
import { toast } from "./toast.js";

export const IMAGE_FILTERS = [
  { id: "none", label: "Originale", css: "none" },
  { id: "warm_film", label: "Pellicola calda", css: "brightness(1.04) contrast(1.06) saturate(1.15) sepia(.12)" },
  { id: "cool_film", label: "Pellicola fredda", css: "brightness(1.02) contrast(1.05) saturate(.92) hue-rotate(-6deg)" },
  { id: "vintage", label: "Vintage", css: "sepia(.35) contrast(.92) brightness(1.05) saturate(.85)", vignette: true, grain: true },
  { id: "bw", label: "Bianco e nero", css: "grayscale(1) contrast(1.1)" },
  { id: "cinematic", label: "Cinematografico", css: "contrast(1.15) saturate(.9) brightness(.97)", vignette: true },
  { id: "soft_glow", label: "Morbido / soft glow", css: "brightness(1.05) contrast(.94) saturate(1.05)", glow: true },
  { id: "film_grain", label: "Grana pellicola", css: "contrast(1.03) saturate(1.02)", grain: true },
  { id: "muted", label: "Naturale desaturato", css: "saturate(.75) contrast(1.02) brightness(1.01)" },
  { id: "vignette", label: "Vignettatura", css: "contrast(1.03)", vignette: true },
];

export function getFilterById(id) {
  return IMAGE_FILTERS.find((f) => f.id === id) || IMAGE_FILTERS[0];
}

function drawVignette(ctx, w, h) {
  const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrain(ctx, w, h) {
  const tile = 140;
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = tile;
  noiseCanvas.height = tile;
  const nctx = noiseCanvas.getContext("2d");
  const imgData = nctx.createImageData(tile, tile);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 90;
    imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = v;
    imgData.data[i + 3] = 255;
  }
  nctx.putImageData(imgData, 0, 0);
  const pattern = ctx.createPattern(noiseCanvas, "repeat");
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGlow(ctx, img, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.25;
  ctx.filter = "blur(8px) brightness(1.1)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

/** Bakes `filterId` onto an already-loaded <img> and resolves a PNG Blob. */
export function bakeFilteredImage(img, filterId) {
  return new Promise((resolve, reject) => {
    const def = getFilterById(filterId);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { reject(new Error("image has no size")); return; }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.filter = def.css || "none";
    ctx.drawImage(img, 0, 0, w, h);
    ctx.filter = "none";
    if (def.glow) drawGlow(ctx, img, w, h);
    if (def.vignette) drawVignette(ctx, w, h);
    if (def.grain) drawGrain(ctx, w, h);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

/**
 * Opens a filter picker for one generated image. Live preview is CSS-only
 * (cheap, instant); "Salva come nuova immagine" bakes the real pixels with
 * canvas and stores a brand-new image in the archive.
 * @param {string} imageId
 * @param {{onSaved?: (newImageId:string) => void}} [opts]
 */
export async function openImageFilterPicker(imageId, { onSaved } = {}) {
  const rec = await getImageRecord(imageId);
  if (!rec) { toast("Immagine non trovata."); return; }
  const url = URL.createObjectURL(rec.blob);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "image-viewer-overlay";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const card = document.createElement("div");
    card.className = "card filter-picker-card";
    card.innerHTML = `<h3>🎨 Filtri immagine</h3><p class="muted" style="margin-top:-4px;">Dai un aspetto meno "artificiale" al render: scegli un filtro, poi salvalo come nuova immagine.</p>`;

    const previewWrap = document.createElement("div");
    previewWrap.className = "filter-preview-wrap";
    const previewImg = document.createElement("img");
    previewImg.src = url;
    previewImg.className = "filter-preview-img";
    const vignetteLayer = document.createElement("div");
    vignetteLayer.className = "filter-vignette-layer";
    const grainLayer = document.createElement("div");
    grainLayer.className = "filter-grain-layer";
    previewWrap.append(previewImg, vignetteLayer, grainLayer);
    card.appendChild(previewWrap);

    const strip = document.createElement("div");
    strip.className = "filter-strip";
    card.appendChild(strip);

    let activeId = "none";
    function applyPreview(id) {
      activeId = id;
      const def = getFilterById(id);
      previewImg.style.filter = def.css || "none";
      vignetteLayer.style.opacity = def.vignette ? "1" : "0";
      grainLayer.style.opacity = def.grain ? "1" : "0";
      previewWrap.style.boxShadow = def.glow ? "0 0 24px 4px rgba(255,255,255,.18) inset" : "none";
      strip.querySelectorAll(".filter-chip").forEach((el) => el.classList.toggle("selected", el.dataset.id === id));
    }

    IMAGE_FILTERS.forEach((def) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (def.id === "none" ? " selected" : "");
      chip.dataset.id = def.id;
      chip.innerHTML = `<img src="${url}" style="filter:${def.css || "none"}"><span>${def.label}</span>`;
      chip.addEventListener("click", () => applyPreview(def.id));
      strip.appendChild(chip);
    });

    const btnRow = document.createElement("div");
    btnRow.className = "row";
    btnRow.style.cssText = "justify-content:flex-end;margin-top:14px;gap:8px;";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn";
    cancelBtn.textContent = "Chiudi";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "💾 Salva come nuova immagine";
    btnRow.append(cancelBtn, saveBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function finish() { URL.revokeObjectURL(url); overlay.remove(); resolve(); }
    cancelBtn.addEventListener("click", finish);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(); });

    saveBtn.addEventListener("click", async () => {
      if (activeId === "none") { toast('Scegli un filtro diverso da "Originale" prima di salvare.'); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = "Salvataggio…";
      try {
        const bakeImg = new Image();
        await new Promise((res, rej) => { bakeImg.onload = res; bakeImg.onerror = rej; bakeImg.src = url; });
        const blob = await bakeFilteredImage(bakeImg, activeId);
        const newId = await saveImageBlob(blob, { ...rec.meta, hidden: false, filterApplied: activeId, sourceImageId: imageId });
        toast("Immagine filtrata salvata in Archivio.");
        if (onSaved) onSaved(newId);
        finish();
      } catch (err) {
        toast("Errore nel salvare l'immagine filtrata.");
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 Salva come nuova immagine";
      }
    });
  });
}
