// ==========================================================================
// modules/home.js — HOME: 3 grandi pulsanti, nient'altro.
// ==========================================================================

export async function render(container, params, { navigate }) {
  container.innerHTML = `
    <div class="hub-header">
      <h1>Prompt Studio</h1>
      <p>Cosa vuoi fare oggi?</p>
    </div>
    <div class="big-choices">
      <div class="big-choice" id="goBuilder">
        <div class="ico">🧑‍🎨</div>
        <div class="title">CREA PERSONAGGIO / PROMPT</div>
        <div class="desc">Percorso guidato: corpo, volto, capelli, azione, scena, camera e luce.</div>
      </div>
      <div class="big-choice" id="goComfy">
        <div class="ico">🧩</div>
        <div class="title">COMFYUI STUDIO</div>
        <div class="desc">Workflow, modelli, LoRA, checkpoint, nodi e generazione.</div>
      </div>
      <div class="big-choice" id="goAi">
        <div class="ico">✨</div>
        <div class="title">GENERA CON IA</div>
        <div class="desc">Prepara il progetto per ChatGPT, Gemini o Meta AI.</div>
      </div>
    </div>
    <div class="row center-text" style="justify-content:center;margin-top:26px;">
      <button class="btn btn-ghost" id="goGallery">🖼️ Apri l'archivio (personaggi, reference, progetti)</button>
    </div>
  `;

  container.querySelector("#goBuilder").addEventListener("click", () => navigate("/builder/1"));
  container.querySelector("#goComfy").addEventListener("click", () => navigate("/comfy"));
  container.querySelector("#goAi").addEventListener("click", () => navigate("/ai"));
  container.querySelector("#goGallery").addEventListener("click", () => navigate("/gallery"));
}
