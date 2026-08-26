// ==========================================================================
// imageViewer.js — fullscreen viewer with pinch-to-zoom, drag-to-pan and
// double-tap/double-click to zoom, like a phone's photo gallery.
// Used to inspect generated images / references closely (eyes, skin, hair).
// ==========================================================================

let state = null;

export function openImageViewer(url, { title = "", allowClose = true } = {}) {
  const overlay = document.getElementById("imageViewerOverlay");
  overlay.innerHTML = "";
  overlay.classList.remove("hidden");

  const top = document.createElement("div");
  top.className = "iv-topbar";
  if (title) {
    const t = document.createElement("div");
    t.className = "muted";
    t.style.marginRight = "auto";
    t.style.paddingLeft = "6px";
    t.textContent = title;
    top.appendChild(t);
  }
  const resetBtn = document.createElement("button");
  resetBtn.className = "icon-btn";
  resetBtn.textContent = "⤢";
  resetBtn.title = "Adatta";
  top.appendChild(resetBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "icon-btn";
  closeBtn.textContent = "✕";
  closeBtn.title = "Chiudi";
  top.appendChild(closeBtn);

  const wrap = document.createElement("div");
  wrap.className = "iv-canvas-wrap";
  const img = document.createElement("img");
  img.src = url;
  img.draggable = false;
  wrap.appendChild(img);

  overlay.appendChild(top);
  overlay.appendChild(wrap);

  let scale = 1, tx = 0, ty = 0;
  function apply() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }
  function reset() { scale = 1; tx = 0; ty = 0; apply(); }
  resetBtn.addEventListener("click", reset);

  function close() {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
    window.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape" && allowClose) close(); }
  window.addEventListener("keydown", onKey);
  closeBtn.addEventListener("click", () => allowClose && close());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay && allowClose) close();
  });

  // ---- Pointer-based pan + pinch zoom (works for mouse & touch) ----
  const pointers = new Map();
  let lastDist = null;
  let dragging = false;
  let lastX = 0, lastY = 0;

  wrap.addEventListener("pointerdown", (e) => {
    wrap.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastDist != null) {
        const delta = dist / lastDist;
        scale = Math.min(6, Math.max(1, scale * delta));
        apply();
      }
      lastDist = dist;
    } else if (dragging && pointers.size === 1) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (scale > 1) {
        tx += dx; ty += dy;
        apply();
      }
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastDist = null;
    if (pointers.size === 0) dragging = false;
  }
  wrap.addEventListener("pointerup", endPointer);
  wrap.addEventListener("pointercancel", endPointer);
  wrap.addEventListener("pointerleave", endPointer);

  // Wheel zoom (desktop)
  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    scale = Math.min(6, Math.max(1, scale - e.deltaY * 0.0015 * scale));
    if (scale === 1) { tx = 0; ty = 0; }
    apply();
  }, { passive: false });

  // Double-click / double-tap to zoom
  let lastTap = 0;
  wrap.addEventListener("pointerup", () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      scale = scale > 1 ? 1 : 2.5;
      if (scale === 1) { tx = 0; ty = 0; }
      apply();
    }
    lastTap = now;
  });

  state = { close };
  return { close };
}

export function closeImageViewer() {
  if (state) state.close();
}
