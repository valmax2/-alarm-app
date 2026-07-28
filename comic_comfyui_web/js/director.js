import { qs, el, toast } from "./utils.js";

// Visual "virtual camera" pickers: two draggable diagrams (no real device
// camera involved) that let the user decide, by eye, from where the shot
// should be framed relative to the character — horizontally (front / side /
// back) and vertically (above / eye-level / below).

let horizontalAngle = 0; // degrees, 0..360, 0 = front (same side as the facing arrow)
let verticalAngle = 90; // degrees, 0..180, 0 = directly above, 180 = directly below
let appliedTags = [];

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

function bucketFor(list, value) {
  return list.find((b) => value < b.max) || list[list.length - 1];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

  // Facing arrow (green), fixed pointing up = character's front.
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

  // Subject.
  ctx.fillStyle = "#7c5cff";
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();

  // Camera marker.
  const rad = (horizontalAngle * Math.PI) / 180;
  const camX = cx + radius * Math.sin(rad);
  const camY = cy - radius * Math.cos(rad);
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📷", camX, camY);
}

function angleFromPointer(evt, cx, cy, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (evt.clientX - rect.left) * scaleX;
  const py = (evt.clientY - rect.top) * scaleY;
  return { px, py, dx: px - cx, dy: py - cy };
}

function initTopDownDiagram() {
  const canvas = qs("#director-topdown");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  let dragging = false;

  function updateFromEvent(evt) {
    const { dx, dy } = angleFromPointer(evt, cx, cy, canvas);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    horizontalAngle = deg;
    drawTopDown();
    qs("#director-topdown-label").textContent = bucketFor(HORIZONTAL_BUCKETS, horizontalAngle).it;
  }

  canvas.addEventListener("pointerdown", (evt) => {
    dragging = true;
    canvas.setPointerCapture(evt.pointerId);
    updateFromEvent(evt);
  });
  canvas.addEventListener("pointermove", (evt) => {
    if (dragging) updateFromEvent(evt);
  });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  drawTopDown();
  qs("#director-topdown-label").textContent = bucketFor(HORIZONTAL_BUCKETS, horizontalAngle).it;
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

  // Subject: simple standing figure.
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

  // Camera marker along the arc.
  const canvasAngleDeg = clamp(verticalAngle - 90, -90, 90);
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
    const { dx, dy } = angleFromPointer(evt, pivotX, pivotY, canvas);
    let canvasAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    canvasAngleDeg = clamp(canvasAngleDeg, -90, 90);
    verticalAngle = canvasAngleDeg + 90;
    drawElevation();
    qs("#director-elevation-label").textContent = bucketFor(VERTICAL_BUCKETS, verticalAngle).it;
  }

  canvas.addEventListener("pointerdown", (evt) => {
    dragging = true;
    canvas.setPointerCapture(evt.pointerId);
    updateFromEvent(evt);
  });
  canvas.addEventListener("pointermove", (evt) => {
    if (dragging) updateFromEvent(evt);
  });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  drawElevation();
  qs("#director-elevation-label").textContent = bucketFor(VERTICAL_BUCKETS, verticalAngle).it;
}

// --- Applied tags (fed into the prompt optimizer) ---

export function getAppliedDirectorTags() {
  return [...appliedTags];
}

export function clearAppliedDirectorTags() {
  appliedTags = [];
  renderAppliedList();
}

function renderAppliedList() {
  const root = qs("#director-applied-list");
  root.innerHTML = "";
  for (const tag of appliedTags) {
    root.appendChild(el("span", { class: "applied-tag-chip", text: tag }));
  }
}

function applyToPrompt() {
  const newTags = [
    bucketFor(HORIZONTAL_BUCKETS, horizontalAngle).en,
    bucketFor(VERTICAL_BUCKETS, verticalAngle).en,
    qs("#director-lighting").value,
    qs("#director-shot").value,
    qs("#director-composition").value,
  ].filter(Boolean);

  for (const tag of newTags) {
    if (!appliedTags.includes(tag)) appliedTags.push(tag);
  }
  renderAppliedList();
  toast("Direttive di regia applicate al prompt.", "success");
}

export function initDirector() {
  initTopDownDiagram();
  initElevationDiagram();
  qs("#director-apply-btn").addEventListener("click", applyToPrompt);
  qs("#director-clear-btn").addEventListener("click", () => {
    clearAppliedDirectorTags();
    toast("Direttive di regia svuotate.", "info");
  });
  renderAppliedList();
}
