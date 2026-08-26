// Small themed replacement for window.prompt()/confirm(), consistent with
// the rest of the UI (the native browser dialogs look out of place).

export function askText({ title = "Inserisci un valore", placeholder = "", value = "" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "image-viewer-overlay";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "380px";
    card.style.width = "90vw";
    card.innerHTML = `
      <h3>${title}</h3>
      <input type="text" id="askInput" placeholder="${placeholder}" value="${value}"
        style="width:100%;background:var(--bg-elev-2);border:1px solid rgba(201,160,99,.3);color:var(--text);border-radius:8px;padding:10px;font-size:.9rem;"/>
      <div class="row" style="justify-content:flex-end;margin-top:14px;">
        <button class="btn" id="askCancel">Annulla</button>
        <button class="btn btn-primary" id="askOk">OK</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    const input = card.querySelector("#askInput");
    input.focus();
    input.select();

    function finish(v) { overlay.remove(); resolve(v); }
    card.querySelector("#askOk").addEventListener("click", () => finish(input.value));
    card.querySelector("#askCancel").addEventListener("click", () => finish(null));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(input.value); if (e.key === "Escape") finish(null); });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(null); });
  });
}

export function askConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "image-viewer-overlay";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const card = document.createElement("div");
    card.className = "card";
    card.style.maxWidth = "380px";
    card.style.width = "90vw";
    card.innerHTML = `
      <p>${message}</p>
      <div class="row" style="justify-content:flex-end;margin-top:14px;">
        <button class="btn" id="cnCancel">Annulla</button>
        <button class="btn btn-danger" id="cnOk">Conferma</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    function finish(v) { overlay.remove(); resolve(v); }
    card.querySelector("#cnOk").addEventListener("click", () => finish(true));
    card.querySelector("#cnCancel").addEventListener("click", () => finish(false));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(false); });
  });
}
