import { qs, el, toast } from "./utils.js";

// Visual "virtual camera" pickers: draggable diagrams (no real device camera
// involved) that let the user decide, by eye, from where the shot should be
// framed relative to the character — horizontally (front / side / back),
// vertically (above / eye-level / below), and how tightly zoomed in
// (face-only through full body, with a live crop preview).

const STORAGE_KEY = "comic-studio:director-settings";

const DEFAULTS = {
  horizontalAngle: 0, // degrees, 0..360, 0 = front (same side as the facing arrow)
  verticalAngle: 90, // degrees, 0..180, 0 = directly above, 180 = directly below
  framingBoundaryY: 150, // px along the framing silhouette, smaller = tighter zoom
  lighting: "soft natural lighting",
  composition: "rule of thirds composition",
};

const EMPTY_APPLIED = { horizontal: null, vertical: null, framing: null, lighting: null, composition: null };

let state = { ...DEFAULTS };
// One slot per category: applying always REPLACES the previous choice in
// that category instead of piling up every angle ever tried, which used to
// leave contradictory tags (e.g. "front view" and "back view" together) in
// the prompt and made the camera controls feel like they did nothing.
let applied = { ...EMPTY_APPLIED };

const HORIZONTAL_BUCKETS = [
  { max: 22.5, en: "front view, character facing the camera", it: "Frontale" },
  { max: 67.5, en: "three-quarter front view", it: "Tre quarti frontale" },
  { max: 112.5, en: "profile side view", it: "Laterale (di profilo)" },
  { max: 157.5, en: "three-quarter back view", it: "Tre quarti da dietro" },
  { max: 202.5, en: "back view, viewed from behind", it: "Da dietro" },
  { max: 247.5, en: "three-quarter back view", it: "Tre quarti da dietro" },
  { max: 292.5, en: "profile side view", it: "Laterale (di profilo)" },
  { max: 337.5, en: "three-quarter front view", it: "Tre quarti frontale" },
  { max: 361, en: "front view, character facing the camera", it: "Frontale" },
];

const VERTICAL_BUCKETS = [
  { max: 25, en: "bird's eye view, directly from above", it: "Dall'alto (verticale)" },
  { max: 70, en: "high angle shot, looking down at the character", it: "Angolazione alta" },
  { max: 110, en: "eye-level shot", it: "Altezza occhi" },
  { max: 155, en: "low angle shot, looking up at the character", it: "Angolazione bassa" },
  { max: 181, en: "worm's eye view, directly from below", it: "Dal basso (verticale)" },
];

// Boundary Y thresholds line up with the landmarks drawn in drawFraming().
const FRAMING_BUCKETS = [
  { max: 65, en: "extreme close-up, detailed face, full head visible with headroom, not cropped", it: "Primissimo piano (viso)" },
  { max: 95, en: "close-up shot, head and shoulders, full head visible with headroom, not cropped", it: "Primo piano (testa e spalle)" },
  { max: 150, en: "medium close-up shot, upper body, full head visible with headroom", it: "Mezzo busto" },
  { max: 200, en: "medium shot, three-quarter body, full head visible", it: "Piano americano (tre quarti)" },
  { max: 999, en: "wide shot, full body, head to toe fully visible", it: "Figura intera" },
];

function bucketFor(list, value) {
  return list.find((b) => value < b.max) || list[list.length - 1];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { settings: { ...DEFAULTS }, applied: { ...EMPTY_APPLIED } };
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULTS, ...parsed.settings },
      applied: { ...EMPTY_APPLIED, ...parsed.applied },
    };
  } catch {
    return { settings: { ...DEFAULTS }, applied: { ...EMPTY_APPLIED } };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: state, applied }));
}

// --- Top-down diagram ---

function drawTopDown() {
  const canvas = qs("#director-topdown");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = w / 2 - 30;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#35c98f";
  ctx.fillStyle = "#35c98f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - 42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 52);
  ctx.lineTo(cx - 7, cy - 38);
  ctx.lineTo(cx + 7, cy - 38);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#7c5cff";
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();

  const rad = (state.horizontalAngle * Math.PI) / 180;
  const camX = cx + radius * Math.sin(rad);
  const camY = cy - radius * Math.cos(rad);
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📷", camX, camY);
}

function pointerToCanvas(evt, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { px: (evt.clientX - rect.left) * scaleX, py: (evt.clientY - rect.top) * scaleY };
}

function initTopDownDiagram() {
  const canvas = qs("#director-topdown");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  let dragging = false;

  function updateFromEvent(evt) {
    const { px, py } = pointerToCanvas(evt, canvas);
    let deg = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    state.horizontalAngle = deg;
    drawTopDown();
    qs("#director-topdown-label").textContent = bucketFor(HORIZONTAL_BUCKETS, state.horizontalAngle).it;
  }

  canvas.addEventListener("pointerdown", (evt) => {
    dragging = true;
    canvas.setPointerCapture(evt.pointerId);
    updateFromEvent(evt);
  });
  canvas.addEventListener("pointermove", (evt) => { if (dragging) updateFromEvent(evt); });
  canvas.addEventListener("pointerup", () => { dragging = false; saveState(); });
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  drawTopDown();
  qs("#director-topdown-label").textContent = bucketFor(HORIZONTAL_BUCKETS, state.horizontalAngle).it;
}

// --- Elevation (side) diagram ---

function drawElevation() {
  const canvas = qs("#director-elevation");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pivotX = w * 0.3;
  const pivotY = h / 2;
  const radius = Math.min(w, h) / 2 - 20;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, radius, -Math.PI / 2, Math.PI / 2, false);
  ctx.stroke();

  ctx.strokeStyle = "#7c5cff";
  ctx.fillStyle = "#7c5cff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY - 22, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY - 15);
  ctx.lineTo(pivotX, pivotY + 20);
  ctx.stroke();

  const canvasAngleDeg = clamp(state.verticalAngle - 90, -90, 90);
  const rad = (canvasAngleDeg * Math.PI) / 180;
  const camX = pivotX + radius * Math.cos(rad);
  const camY = pivotY + radius * Math.sin(rad);
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📷", camX, camY);
}

function initElevationDiagram() {
  const canvas = qs("#director-elevation");
  const pivotX = canvas.width * 0.3;
  const pivotY = canvas.height / 2;
  let dragging = false;

  function updateFromEvent(evt) {
    const { px, py } = pointerToCanvas(evt, canvas);
    let canvasAngleDeg = (Math.atan2(py - pivotY, px - pivotX) * 180) / Math.PI;
    canvasAngleDeg = clamp(canvasAngleDeg, -90, 90);
    state.verticalAngle = canvasAngleDeg + 90;
    drawElevation();
    qs("#director-elevation-label").textContent = bucketFor(VERTICAL_BUCKETS, state.verticalAngle).it;
  }

  canvas.addEventListener("pointerdown", (evt) => {
    dragging = true;
    canvas.setPointerCapture(evt.pointerId);
    updateFromEvent(evt);
  });
  canvas.addEventListener("pointermove", (evt) => { if (dragging) updateFromEvent(evt); });
  canvas.addEventListener("pointerup", () => { dragging = false; saveState(); });
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  drawElevation();
  qs("#director-elevation-label").textContent = bucketFor(VERTICAL_BUCKETS, state.verticalAngle).it;
}

// --- Framing / zoom diagram: body silhouette with a live crop preview ---

const FRAMING_MIN_Y = 45;
const FRAMING_MAX_Y = 235;

function drawFraming() {
  const canvas = qs("#director-framing");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;

  ctx.clearRect(0, 0, w, h);

  // Silhouette: head, torso, legs.
  ctx.fillStyle = "#4a5080";
  ctx.beginPath();
  ctx.arc(cx, 40, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 26, 58);
  ctx.lineTo(cx + 26, 58);
  ctx.lineTo(cx + 22, 168);
  ctx.lineTo(cx - 22, 168);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 20, 168, 16, 64);
  ctx.fillRect(cx + 4, 168, 16, 64);

  // Out-of-frame overlay (below the boundary).
  ctx.fillStyle = "rgba(5,6,14,0.78)";
  ctx.fillRect(0, state.framingBoundaryY, w, h - state.framingBoundaryY);

  // Boundary line + handle.
  ctx.strokeStyle = "#7c5cff";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, state.framingBoundaryY);
  ctx.lineTo(w, state.framingBoundaryY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#7c5cff";
  ctx.beginPath();
  ctx.arc(w - 14, state.framingBoundaryY, 9, 0, Math.PI * 2);
  ctx.fill();
}

function initFramingDiagram() {
  const canvas = qs("#director-framing");
  let dragging = false;

  function updateFromEvent(evt) {
    const { py } = pointerToCanvas(evt, canvas);
    state.framingBoundaryY = clamp(py, FRAMING_MIN_Y, FRAMING_MAX_Y);
    drawFraming();
    qs("#director-framing-label").textContent = bucketFor(FRAMING_BUCKETS, state.framingBoundaryY).it;
  }

  canvas.addEventListener("pointerdown", (evt) => {
    dragging = true;
    canvas.setPointerCapture(evt.pointerId);
    updateFromEvent(evt);
  });
  canvas.addEventListener("pointermove", (evt) => { if (dragging) updateFromEvent(evt); });
  canvas.addEventListener("pointerup", () => { dragging = false; saveState(); });
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  drawFraming();
  qs("#director-framing-label").textContent = bucketFor(FRAMING_BUCKETS, state.framingBoundaryY).it;
}

// --- Applied tags (fed into the prompt optimizer) ---
// One value per category — applying always overwrites the previous choice
// in that same category, so the prompt reflects only the latest camera
// setup instead of every angle ever tried.

export function getAppliedDirectorTags() {
  return Object.values(applied).filter(Boolean);
}

export function clearAppliedDirectorTags() {
  applied = { ...EMPTY_APPLIED };
  saveState();
  renderAppliedList();
  notifyTagsUpdated();
}

function renderAppliedList() {
  const root = qs("#director-applied-list");
  root.innerHTML = "";
  for (const tag of getAppliedDirectorTags()) {
    root.appendChild(el("span", { class: "applied-tag-chip", text: tag }));
  }
}

function notifyTagsUpdated() {
  window.dispatchEvent(new CustomEvent("director-tags-updated"));
}

function applyToPrompt() {
  applied = {
    horizontal: bucketFor(HORIZONTAL_BUCKETS, state.horizontalAngle).en,
    vertical: bucketFor(VERTICAL_BUCKETS, state.verticalAngle).en,
    framing: bucketFor(FRAMING_BUCKETS, state.framingBoundaryY).en,
    lighting: state.lighting || null,
    composition: state.composition || null,
  };
  saveState();
  renderAppliedList();
  notifyTagsUpdated();
  toast("Direttive di regia applicate al prompt.", "success");
}

export function initDirector() {
  const loaded = loadState();
  state = loaded.settings;
  applied = loaded.applied;

  qs("#director-lighting").value = state.lighting;
  qs("#director-composition").value = state.composition;

  initTopDownDiagram();
  initElevationDiagram();
  initFramingDiagram();
  renderAppliedList();

  qs("#director-lighting").addEventListener("change", (e) => {
    state.lighting = e.target.value;
    saveState();
  });
  qs("#director-composition").addEventListener("change", (e) => {
    state.composition = e.target.value;
    saveState();
  });

  qs("#director-apply-btn").addEventListener("click", applyToPrompt);
  qs("#director-clear-btn").addEventListener("click", () => {
    clearAppliedDirectorTags();
    toast("Direttive di regia svuotate.", "info");
  });
}
