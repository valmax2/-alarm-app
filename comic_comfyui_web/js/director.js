import { qs, toast } from "./utils.js";
import { addCharacterFromBlob } from "./characters.js";

let stream = null;
let appliedTags = [];

const DIRECTIVE_SELECT_IDS = ["director-angle", "director-lighting", "director-shot", "director-composition"];

export function getAppliedDirectorTags() {
  return [...appliedTags];
}

export function clearAppliedDirectorTags() {
  appliedTags = [];
  window.dispatchEvent(new CustomEvent("director-updated", { detail: appliedTags }));
}

function resizeOverlay(video, canvas) {
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
}

function drawGrid(canvas, visible) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!visible) return;
  const { width, height } = canvas;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  for (const fraction of [1 / 3, 2 / 3]) {
    ctx.beginPath();
    ctx.moveTo(width * fraction, 0);
    ctx.lineTo(width * fraction, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height * fraction);
    ctx.lineTo(width, height * fraction);
    ctx.stroke();
  }
}

async function startCamera() {
  const video = qs("#director-video");
  const overlay = qs("#director-overlay");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  } catch (err) {
    toast(`Impossibile accedere alla webcam: ${err.message}`, "error");
    return;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  resizeOverlay(video, overlay);
  drawGrid(overlay, qs("#director-grid-toggle").checked);

  qs("#director-start-btn").disabled = true;
  qs("#director-snapshot-btn").disabled = false;
  qs("#director-stop-btn").disabled = false;
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  const video = qs("#director-video");
  video.srcObject = null;
  qs("#director-start-btn").disabled = false;
  qs("#director-snapshot-btn").disabled = true;
  qs("#director-stop-btn").disabled = true;
  drawGrid(qs("#director-overlay"), false);
}

async function takeSnapshot() {
  const video = qs("#director-video");
  const captureCanvas = qs("#director-capture");
  if (!video.videoWidth) {
    toast("La webcam non è ancora pronta.", "error");
    return;
  }
  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;
  const ctx = captureCanvas.getContext("2d");
  ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

  captureCanvas.toBlob(async (blob) => {
    if (!blob) {
      toast("Errore durante la cattura dello scatto.", "error");
      return;
    }
    const name = `Scatto regia ${new Date().toLocaleTimeString("it-IT")}`;
    await addCharacterFromBlob(blob, name);
    toast(`Scatto salvato tra i personaggi come "${name}".`, "success");
  }, "image/png");
}

function applyToPrompt() {
  const newTags = DIRECTIVE_SELECT_IDS.map((id) => qs(`#${id}`).value).filter(Boolean);
  for (const tag of newTags) {
    if (!appliedTags.includes(tag)) appliedTags.push(tag);
  }
  window.dispatchEvent(new CustomEvent("director-updated", { detail: appliedTags }));
  toast("Direttive di regia applicate al prompt.", "success");
}

export function initDirector() {
  qs("#director-start-btn").addEventListener("click", startCamera);
  qs("#director-stop-btn").addEventListener("click", stopCamera);
  qs("#director-snapshot-btn").addEventListener("click", takeSnapshot);
  qs("#director-apply-btn").addEventListener("click", applyToPrompt);
  qs("#director-grid-toggle").addEventListener("change", (e) => {
    drawGrid(qs("#director-overlay"), e.target.checked);
  });

  window.addEventListener("resize", () => {
    const video = qs("#director-video");
    const overlay = qs("#director-overlay");
    if (video.srcObject) {
      resizeOverlay(video, overlay);
      drawGrid(overlay, qs("#director-grid-toggle").checked);
    }
  });

  window.addEventListener("beforeunload", stopCamera);
}
