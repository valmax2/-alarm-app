// ==========================================================================
// components/promptBar.js — the persistent "PROMPT IN COSTRUZIONE" panel
// shown throughout Module 1, per the UX principle that the user must always
// see what has been built so far.
// ==========================================================================

import { getPromptBarSummary, subscribe } from "../state.js";

let unsub = null;

export function mountPromptBar(promptBarEl) {
  promptBarEl.innerHTML = "";
  const toggle = document.createElement("div");
  toggle.className = "prompt-bar-toggle";
  toggle.innerHTML = `<strong>Prompt in costruzione</strong><span class="prompt-bar-count"></span>`;
  const textBox = document.createElement("div");
  textBox.className = "prompt-bar-text";

  promptBarEl.appendChild(toggle);
  promptBarEl.appendChild(textBox);

  toggle.addEventListener("click", () => promptBarEl.classList.toggle("collapsed"));

  function draw() {
    const tags = getPromptBarSummary();
    toggle.querySelector(".prompt-bar-count").textContent = tags.length ? `${tags.length} elementi` : "vuoto";
    textBox.innerHTML = tags.length
      ? tags.map((t) => `<span class="frag-tag">${escapeHtml(t)}</span>`).join("")
      : `<span class="faint">Le tue scelte appariranno qui.</span>`;
  }

  draw();
  if (unsub) unsub();
  unsub = subscribe(draw);
}

export function unmountPromptBar() {
  if (unsub) { unsub(); unsub = null; }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
