// ==========================================================================
// components/cameraOrbit.js — STEP 7 (Camera e luce): interactive drag-to-
// orbit camera widget. The subject sits fixed at the center; the user drags
// a camera icon around it to pick the point of view (frontale / 3/4 / profilo
// / posteriore). A cone always points from the camera toward the subject,
// and a fixed green arrow marks the direction the subject is facing.
// ==========================================================================

const SVG_NS = "http://www.w3.org/2000/svg";

const YAW_PRESETS = {
  frontale: { label: "Frontale", angle: 90 },
  tre_quarti_sx: { label: "3/4 sinistra", angle: 135 },
  tre_quarti_dx: { label: "3/4 destra", angle: 45 },
  profilo: { label: "Profilo", angle: 180 },
  posteriore: { label: "Posteriore", angle: 270 },
};

function normalizeAngle(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function presetForAngle(theta) {
  const diff = normalizeAngle(theta - 90);
  const abs = Math.abs(diff);
  if (abs <= 22.5) return { id: "frontale", ...YAW_PRESETS.frontale };
  if (abs <= 67.5) return diff > 0
    ? { id: "tre_quarti_sx", ...YAW_PRESETS.tre_quarti_sx }
    : { id: "tre_quarti_dx", ...YAW_PRESETS.tre_quarti_dx };
  if (abs <= 112.5) return { id: "profilo", ...YAW_PRESETS.profilo };
  return { id: "posteriore", ...YAW_PRESETS.posteriore };
}

/**
 * @param {HTMLElement} container
 * @param {() => string|null} getSelected — current punto_vista preset id
 * @param {(id:string) => void} onSelect — called when the camera settles on
 * a (possibly new) preset, on drag release or tap
 */
export function renderCameraOrbit(container, { getSelected, onSelect }) {
  const W = 260, H = 220, cx = 130, cy = 100, R = 78, subjectR = 22;

  const wrap = document.createElement("div");
  wrap.className = "camera-orbit-wrap";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "camera-orbit-svg");
  svg.style.touchAction = "none";

  const defs = document.createElementNS(SVG_NS, "defs");
  defs.innerHTML = `<marker id="orbitArrowHead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#3ecf6e"/></marker>`;
  svg.appendChild(defs);

  const guide = document.createElementNS(SVG_NS, "circle");
  guide.setAttribute("cx", String(cx));
  guide.setAttribute("cy", String(cy));
  guide.setAttribute("r", String(R));
  guide.setAttribute("class", "orbit-guide");
  svg.appendChild(guide);

  const cone = document.createElementNS(SVG_NS, "polygon");
  cone.setAttribute("class", "orbit-cone");
  svg.appendChild(cone);

  const subject = document.createElementNS(SVG_NS, "circle");
  subject.setAttribute("cx", String(cx));
  subject.setAttribute("cy", String(cy));
  subject.setAttribute("r", String(subjectR));
  subject.setAttribute("class", "orbit-subject");
  svg.appendChild(subject);

  // fixed green arrow: which way the subject is facing
  const arrowLen = subjectR + 20;
  const arrow = document.createElementNS(SVG_NS, "line");
  arrow.setAttribute("x1", String(cx));
  arrow.setAttribute("y1", String(cy));
  arrow.setAttribute("x2", String(cx));
  arrow.setAttribute("y2", String(cy + arrowLen));
  arrow.setAttribute("class", "orbit-face-arrow");
  arrow.setAttribute("marker-end", "url(#orbitArrowHead)");
  svg.appendChild(arrow);

  const camGroup = document.createElementNS(SVG_NS, "g");
  camGroup.setAttribute("class", "orbit-camera");
  const camDot = document.createElementNS(SVG_NS, "circle");
  camDot.setAttribute("r", "15");
  camDot.setAttribute("class", "orbit-camera-dot");
  const camIcon = document.createElementNS(SVG_NS, "text");
  camIcon.setAttribute("class", "orbit-camera-icon");
  camIcon.setAttribute("text-anchor", "middle");
  camIcon.setAttribute("dominant-baseline", "central");
  camIcon.textContent = "📷";
  camGroup.append(camDot, camIcon);
  svg.appendChild(camGroup);

  const label = document.createElement("div");
  label.className = "orbit-label";
  const hint = document.createElement("div");
  hint.className = "orbit-hint";
  hint.textContent = "Trascina la fotocamera intorno al soggetto per scegliere il punto di vista.";

  wrap.append(svg, label, hint);
  container.appendChild(wrap);

  function place(theta) {
    const rad = (theta * Math.PI) / 180;
    const camX = cx + R * Math.cos(rad);
    const camY = cy + R * Math.sin(rad);
    camGroup.setAttribute("transform", `translate(${camX},${camY})`);

    const dirX = cx - camX, dirY = cy - camY;
    const dist = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / dist, uy = dirY / dist;
    const px = -uy, py = ux;
    const spread = 16;
    const reach = Math.max(dist - subjectR - 4, 10);
    const baseX = camX + ux * reach, baseY = camY + uy * reach;
    const p1x = baseX + px * spread, p1y = baseY + py * spread;
    const p2x = baseX - px * spread, p2y = baseY - py * spread;
    cone.setAttribute("points", `${camX},${camY} ${p1x},${p1y} ${p2x},${p2y}`);

    const preset = presetForAngle(theta);
    label.textContent = `📍 ${preset.label}`;
    return preset;
  }

  let angle = YAW_PRESETS[getSelected()]?.angle ?? 90;
  place(angle);

  function angleFromClientPoint(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
  }

  let dragging = false;

  function onPointerMove(evt) {
    if (!dragging) return;
    angle = angleFromClientPoint(evt.clientX, evt.clientY);
    place(angle);
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    camGroup.classList.remove("dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    const preset = place(angle);
    onSelect(preset.id);
  }

  camGroup.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    dragging = true;
    camGroup.classList.add("dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  });

  // tap anywhere on the ring to jump the camera straight there
  svg.addEventListener("pointerdown", (evt) => {
    if (camGroup.contains(evt.target)) return;
    angle = angleFromClientPoint(evt.clientX, evt.clientY);
    const preset = place(angle);
    onSelect(preset.id);
  });

  return wrap;
}
