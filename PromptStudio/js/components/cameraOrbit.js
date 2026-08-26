// ==========================================================================
// components/cameraOrbit.js — STEP 7 (Camera e luce): professional
// interactive camera rig with two synced views:
//  - top-down orbit (drag around the subject) → punto di vista orizzontale
//    (frontale / 3/4 / profilo / posteriore)
//  - lateral/side view (drag up/down) → altezza camera (dal basso / low
//    angle / altezza occhi / high angle / top down), always aimed at the
//    subject's face so the tilt happens automatically — go to ground level
//    and the cone visibly tilts up toward the face
// A shared zoom dial changes, in real time, the camera-to-subject distance
// and cone width in BOTH views at once (zoom in = camera moves closer /
// narrower cone, zoom out = camera moves back / wider cone).
// ==========================================================================

const SVG_NS = "http://www.w3.org/2000/svg";

const YAW_PRESETS = {
  frontale: { label: "Frontale", angle: 90 },
  tre_quarti_sx: { label: "3/4 sinistra", angle: 135 },
  tre_quarti_dx: { label: "3/4 destra", angle: 45 },
  profilo: { label: "Profilo", angle: 180 },
  posteriore: { label: "Posteriore", angle: 270 },
};

const ELEVATION_PRESETS = {
  dal_basso: { label: "Dal basso (a terra)", phi: -75 },
  low_angle: { label: "Low angle", phi: -35 },
  high_angle: { label: "High angle", phi: 35 },
  top_down: { label: "Top down", phi: 75 },
};

function normalizeAngle(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function presetForYaw(theta) {
  const diff = normalizeAngle(theta - 90);
  const abs = Math.abs(diff);
  if (abs <= 22.5) return { id: "frontale", ...YAW_PRESETS.frontale };
  if (abs <= 67.5) return diff > 0
    ? { id: "tre_quarti_sx", ...YAW_PRESETS.tre_quarti_sx }
    : { id: "tre_quarti_dx", ...YAW_PRESETS.tre_quarti_dx };
  if (abs <= 112.5) return { id: "profilo", ...YAW_PRESETS.profilo };
  return { id: "posteriore", ...YAW_PRESETS.posteriore };
}

function presetForElevation(phi) {
  if (phi <= -55) return { id: "dal_basso", ...ELEVATION_PRESETS.dal_basso };
  if (phi <= -15) return { id: "low_angle", ...ELEVATION_PRESETS.low_angle };
  if (phi < 15) return { id: null, label: "Altezza occhi", phi: 0 };
  if (phi < 55) return { id: "high_angle", ...ELEVATION_PRESETS.high_angle };
  return { id: "top_down", ...ELEVATION_PRESETS.top_down };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}

function makeArrowDefs() {
  const defs = document.createElementNS(SVG_NS, "defs");
  defs.innerHTML = `<marker id="orbitArrowHead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#3ecf6e"/></marker>`;
  return defs;
}

function drawCone(cone, camX, camY, targetX, targetY, targetR, spread) {
  const dirX = targetX - camX, dirY = targetY - camY;
  const dist = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / dist, uy = dirY / dist;
  const px = -uy, py = ux;
  const reach = Math.max(dist - targetR - 4, 10);
  const baseX = camX + ux * reach, baseY = camY + uy * reach;
  const p1x = baseX + px * spread, p1y = baseY + py * spread;
  const p2x = baseX - px * spread, p2y = baseY - py * spread;
  cone.setAttribute("points", `${camX},${camY} ${p1x},${p1y} ${p2x},${p2y}`);
}

/**
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {() => string|null} opts.getYaw
 * @param {(id:string) => void} opts.setYaw
 * @param {() => string|null} opts.getElevation
 * @param {(id:string|null) => void} opts.setElevation
 * @param {() => string|null} opts.getZoom
 * @param {(id:string|null) => void} opts.setZoom
 */
export function renderCameraRig(container, { getYaw, setYaw, getElevation, setElevation, getZoom, setZoom }) {
  const wrap = document.createElement("div");
  wrap.className = "camera-rig-wrap";

  const viewsRow = document.createElement("div");
  viewsRow.className = "camera-rig-views";
  wrap.appendChild(viewsRow);

  // ---------------- shared zoom state ----------------
  const zoomFromId = { zoom_in: 1, zoom_out: -1 };
  let zoomValue = zoomFromId[getZoom()] ?? 0;
  function effectiveRadius(base) { return base * (1 - zoomValue * 0.28); }
  function coneSpread(base) { return base * (1 - zoomValue * 0.45); }

  // ==================================================================
  // TOP-DOWN VIEW (yaw / punto di vista orizzontale)
  // ==================================================================
  const topBox = document.createElement("div");
  topBox.className = "camera-view-box";
  const topCaption = document.createElement("div");
  topCaption.className = "camera-view-caption";
  topCaption.textContent = "Vista dall'alto — punto di vista";
  topBox.appendChild(topCaption);

  const TW = 240, TH = 210, tcx = 120, tcy = 100, tR = 78, tSubjR = 20;
  const topSvg = svgEl("svg", { viewBox: `0 0 ${TW} ${TH}`, class: "camera-orbit-svg" });
  topSvg.style.touchAction = "none";
  topSvg.appendChild(makeArrowDefs());
  topSvg.appendChild(svgEl("circle", { cx: tcx, cy: tcy, r: tR, class: "orbit-guide" }));
  const topCone = svgEl("polygon", { class: "orbit-cone" });
  topSvg.appendChild(topCone);
  topSvg.appendChild(svgEl("circle", { cx: tcx, cy: tcy, r: tSubjR, class: "orbit-subject" }));
  const topArrow = svgEl("line", {
    x1: tcx, y1: tcy, x2: tcx, y2: tcy + tSubjR + 20,
    class: "orbit-face-arrow", "marker-end": "url(#orbitArrowHead)",
  });
  topSvg.appendChild(topArrow);
  const topCamGroup = svgEl("g", { class: "orbit-camera" });
  topCamGroup.append(
    svgEl("circle", { r: 15, class: "orbit-camera-dot" }),
    (() => { const t = svgEl("text", { class: "orbit-camera-icon", "text-anchor": "middle", "dominant-baseline": "central" }); t.textContent = "📷"; return t; })()
  );
  topSvg.appendChild(topCamGroup);
  topBox.appendChild(topSvg);
  const topLabel = document.createElement("div");
  topLabel.className = "orbit-label";
  topBox.appendChild(topLabel);
  viewsRow.appendChild(topBox);

  let yawAngle = YAW_PRESETS[getYaw()]?.angle ?? 90;

  function placeTop() {
    const R = effectiveRadius(tR);
    const rad = (yawAngle * Math.PI) / 180;
    const camX = tcx + R * Math.cos(rad);
    const camY = tcy + R * Math.sin(rad);
    topCamGroup.setAttribute("transform", `translate(${camX},${camY})`);
    drawCone(topCone, camX, camY, tcx, tcy, tSubjR, coneSpread(16));
    const preset = presetForYaw(yawAngle);
    topLabel.textContent = `📍 ${preset.label}`;
    return preset;
  }
  placeTop();

  function topAngleFromPointer(clientX, clientY) {
    const rect = topSvg.getBoundingClientRect();
    const scaleX = TW / rect.width, scaleY = TH / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    return (Math.atan2(py - tcy, px - tcx) * 180) / Math.PI;
  }

  let draggingTop = false;
  function onTopMove(evt) { if (!draggingTop) return; yawAngle = topAngleFromPointer(evt.clientX, evt.clientY); placeTop(); }
  function endTopDrag() {
    if (!draggingTop) return;
    draggingTop = false;
    topCamGroup.classList.remove("dragging");
    window.removeEventListener("pointermove", onTopMove);
    window.removeEventListener("pointerup", endTopDrag);
    window.removeEventListener("pointercancel", endTopDrag);
    setYaw(placeTop().id);
  }
  topCamGroup.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    draggingTop = true;
    topCamGroup.classList.add("dragging");
    window.addEventListener("pointermove", onTopMove);
    window.addEventListener("pointerup", endTopDrag);
    window.addEventListener("pointercancel", endTopDrag);
  });
  topSvg.addEventListener("pointerdown", (evt) => {
    if (topCamGroup.contains(evt.target)) return;
    yawAngle = topAngleFromPointer(evt.clientX, evt.clientY);
    setYaw(placeTop().id);
  });

  // ==================================================================
  // LATERAL VIEW (elevation / altezza + inclinazione automatica)
  // ==================================================================
  const sideBox = document.createElement("div");
  sideBox.className = "camera-view-box";
  const sideCaption = document.createElement("div");
  sideCaption.className = "camera-view-caption";
  sideCaption.textContent = "Vista laterale — altezza (sempre inclinata verso il volto)";
  sideBox.appendChild(sideCaption);

  const SW = 200, SH = 230, scx = 70, sHeadY = 95, sGroundY = 205, sR = 85, sHeadR = 14;
  const sideSvg = svgEl("svg", { viewBox: `0 0 ${SW} ${SH}`, class: "camera-orbit-svg" });
  sideSvg.style.touchAction = "none";
  sideSvg.appendChild(makeArrowDefs());
  // guide arc (right half circle around the head point)
  sideSvg.appendChild(svgEl("path", {
    d: `M ${scx} ${sHeadY - sR} A ${sR} ${sR} 0 0 1 ${scx} ${sHeadY + sR}`,
    class: "orbit-guide", fill: "none",
  }));
  sideSvg.appendChild(svgEl("line", { x1: 10, y1: sGroundY, x2: SW - 10, y2: sGroundY, class: "orbit-ground-line" }));
  const sideCone = svgEl("polygon", { class: "orbit-cone" });
  sideSvg.appendChild(sideCone);
  // subject silhouette: head + body line down to the ground
  sideSvg.appendChild(svgEl("line", { x1: scx, y1: sHeadY + sHeadR, x2: scx, y2: sGroundY, class: "orbit-subject-body" }));
  sideSvg.appendChild(svgEl("circle", { cx: scx, cy: sHeadY, r: sHeadR, class: "orbit-subject" }));
  const sideFaceArrow = svgEl("line", {
    x1: scx, y1: sHeadY, x2: scx + sHeadR + 18, y2: sHeadY,
    class: "orbit-face-arrow", "marker-end": "url(#orbitArrowHead)",
  });
  sideSvg.appendChild(sideFaceArrow);
  const sideCamGroup = svgEl("g", { class: "orbit-camera" });
  sideCamGroup.append(
    svgEl("circle", { r: 15, class: "orbit-camera-dot" }),
    (() => { const t = svgEl("text", { class: "orbit-camera-icon", "text-anchor": "middle", "dominant-baseline": "central" }); t.textContent = "📷"; return t; })()
  );
  sideSvg.appendChild(sideCamGroup);
  sideBox.appendChild(sideSvg);
  const sideLabel = document.createElement("div");
  sideLabel.className = "orbit-label";
  sideBox.appendChild(sideLabel);
  viewsRow.appendChild(sideBox);

  let sidePhi = ELEVATION_PRESETS[getElevation()]?.phi ?? 0;

  function placeSide() {
    const R = effectiveRadius(sR);
    const rad = (sidePhi * Math.PI) / 180;
    const camX = scx + R * Math.cos(rad);
    const camY = sHeadY - R * Math.sin(rad);
    sideCamGroup.setAttribute("transform", `translate(${camX},${camY})`);
    drawCone(sideCone, camX, camY, scx, sHeadY, sHeadR, coneSpread(16));
    const preset = presetForElevation(sidePhi);
    sideLabel.textContent = `📍 ${preset.label}`;
    return preset;
  }
  placeSide();

  function sidePhiFromPointer(clientX, clientY) {
    const rect = sideSvg.getBoundingClientRect();
    const scaleX = SW / rect.width, scaleY = SH / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const dx = Math.max(px - scx, 8); // keep camera on the right side (this is a side view)
    const dy = sHeadY - py;
    return clamp((Math.atan2(dy, dx) * 180) / Math.PI, -90, 90);
  }

  let draggingSide = false;
  function onSideMove(evt) { if (!draggingSide) return; sidePhi = sidePhiFromPointer(evt.clientX, evt.clientY); placeSide(); }
  function endSideDrag() {
    if (!draggingSide) return;
    draggingSide = false;
    sideCamGroup.classList.remove("dragging");
    window.removeEventListener("pointermove", onSideMove);
    window.removeEventListener("pointerup", endSideDrag);
    window.removeEventListener("pointercancel", endSideDrag);
    setElevation(placeSide().id);
  }
  sideCamGroup.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    draggingSide = true;
    sideCamGroup.classList.add("dragging");
    window.addEventListener("pointermove", onSideMove);
    window.addEventListener("pointerup", endSideDrag);
    window.addEventListener("pointercancel", endSideDrag);
  });
  sideSvg.addEventListener("pointerdown", (evt) => {
    if (sideCamGroup.contains(evt.target)) return;
    sidePhi = sidePhiFromPointer(evt.clientX, evt.clientY);
    setElevation(placeSide().id);
  });

  // ==================================================================
  // SHARED ZOOM DIAL — updates both cones live, commits on release
  // ==================================================================
  const zoomRow = document.createElement("div");
  zoomRow.className = "camera-zoom-row";
  const zoomOutIcon = document.createElement("span");
  zoomOutIcon.textContent = "🔭−";
  zoomOutIcon.title = "Zoom out";
  const zoomSlider = document.createElement("input");
  zoomSlider.type = "range";
  zoomSlider.min = "-100";
  zoomSlider.max = "100";
  zoomSlider.step = "1";
  zoomSlider.value = String(Math.round(zoomValue * 100));
  zoomSlider.className = "camera-zoom-slider";
  const zoomInIcon = document.createElement("span");
  zoomInIcon.textContent = "🔎+";
  zoomInIcon.title = "Zoom in";
  const zoomLabel = document.createElement("span");
  zoomLabel.className = "camera-zoom-label";

  function refreshZoomLabel() {
    if (zoomValue > 0.15) zoomLabel.textContent = "Zoom in";
    else if (zoomValue < -0.15) zoomLabel.textContent = "Zoom out";
    else zoomLabel.textContent = "Neutro";
  }
  refreshZoomLabel();

  zoomSlider.addEventListener("input", () => {
    zoomValue = clamp(Number(zoomSlider.value) / 100, -1, 1);
    placeTop();
    placeSide();
    refreshZoomLabel();
  });
  zoomSlider.addEventListener("change", () => {
    const id = zoomValue > 0.3 ? "zoom_in" : zoomValue < -0.3 ? "zoom_out" : null;
    setZoom(id);
  });

  zoomRow.append(zoomOutIcon, zoomSlider, zoomInIcon, zoomLabel);
  wrap.appendChild(zoomRow);

  const hint = document.createElement("div");
  hint.className = "orbit-hint";
  hint.textContent = "Trascina la fotocamera nelle due viste per orbitare e regolare l'altezza; usa lo zoom per avvicinarti o allontanarti in tempo reale.";
  wrap.appendChild(hint);

  container.appendChild(wrap);
  return wrap;
}

// Kept for backward compatibility with any direct callers/tests that only
// need the horizontal orbit (no lateral view / zoom dial).
export function renderCameraOrbit(container, { getSelected, onSelect }) {
  return renderCameraRig(container, {
    getYaw: getSelected,
    setYaw: onSelect,
    getElevation: () => null,
    setElevation: () => {},
    getZoom: () => null,
    setZoom: () => {},
  });
}
