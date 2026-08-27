// ==========================================================================
// components/stepper.js — reusable pieces for the Module 1 wizard:
// step progress dots, collapsible category accordions with chip grids, and
// a labeled custom-text field with dictation.
// ==========================================================================

import { buildDictationRow } from "./voice.js";
import { openCustomOptionDialog } from "./customOptionDialog.js";
import { addCustomOption, removeCustomOption } from "../modules/customOptions.js";
import { askConfirm } from "./promptDialog.js";
import { toast } from "./toast.js";
import { getCategoriesFor } from "../state.js";
import { translateItToEn } from "./translate.js";

/**
 * @param {(stepIndex:number)=>void} [onGoto] — when given, each dot is a
 * button showing its step number that jumps straight to that step.
 */
export function renderStepProgress(container, currentIndex, total, onGoto) {
  const wrap = document.createElement("div");
  wrap.className = "step-progress";
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "step-dot" + (i < currentIndex ? " done" : i === currentIndex ? " active" : "");
    dot.textContent = String(i + 1);
    if (onGoto) {
      dot.title = `Vai allo step ${i + 1}`;
      dot.addEventListener("click", () => onGoto(i));
    } else {
      dot.disabled = true;
    }
    wrap.appendChild(dot);
  }
  container.appendChild(wrap);
}

/**
 * Renders a list of categories as collapsible accordions of chip options.
 * Every chip shows the Italian label on top and the English prompt
 * fragment below it. Each category also gets a dashed "➕ Aggiungi" tile
 * that lets the user create their own button (typed or dictated in
 * Italian, auto-translated to English) — it's saved to a persistent
 * per-category library (customOptions.js) and can be removed again with
 * the small ✕ badge that appears on custom chips only.
 *
 * @param {HTMLElement} container
 * @param {Array} categories - [{id, name, options:[{id,label,frag,custom?}]}]
 * @param {(categoryId:string, optionId:string)=>void} onToggle
 * @param {(categoryId:string, optionId:string)=>boolean} isSelected
 * @param {Set<string>} [openByDefault] category ids to render expanded initially
 * @param {string} [stepKey] enables "add your own" / delete-custom when set
 * @param {(opt:object)=>boolean} [filterOptions] when given, only options
 * passing this predicate are shown (e.g. to carve out a subset of a category
 * that's handled by a different widget elsewhere on the same step)
 */
export function renderCategoryAccordions(container, categories, { onToggle, isSelected, openByDefault, stepKey, filterOptions } = {}) {
  const applyFilter = (cat2) => (filterOptions ? { ...cat2, options: cat2.options.filter(filterOptions) } : cat2);

  categories.forEach((cat, idx) => {
    const box = document.createElement("div");
    box.className = "category" + (openByDefault && openByDefault.has(cat.id) ? " open" : idx === 0 ? " open" : "");

    const head = document.createElement("div");
    head.className = "category-head";
    head.addEventListener("click", () => box.classList.toggle("open"));

    const body = document.createElement("div");
    body.className = "category-body";
    const grid = document.createElement("div");
    grid.className = "chip-grid";
    body.appendChild(grid);
    box.appendChild(head);
    box.appendChild(body);
    container.appendChild(box);

    function updateBadge(cat2) {
      const count = cat2.options.filter((o) => isSelected(cat2.id, o.id)).length;
      head.innerHTML = `<span class="name">${cat2.name}${count ? `<span class="category-badge">${count}</span>` : ""}</span><span class="chev">▶</span>`;
    }

    async function refresh() {
      const freshCat = stepKey ? getFreshCategory(stepKey, cat.id, cat) : cat;
      drawGrid(applyFilter(freshCat));
    }

    function drawGrid(cat2) {
      updateBadge(cat2);
      grid.innerHTML = "";

      cat2.options.forEach((opt) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (isSelected(cat2.id, opt.id) ? " selected" : "");
        chip.innerHTML = `<span class="chip-it">${escapeHtml(opt.label)}</span><span class="chip-en">${escapeHtml(opt.frag)}</span>`;

        if (opt.custom) {
          const del = document.createElement("span");
          del.className = "chip-del";
          del.textContent = "✕";
          del.title = "Rimuovi questo pulsante";
          del.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!(await askConfirm(`Rimuovere il pulsante "${opt.label}"?`))) return;
            removeCustomOption(stepKey, cat2.id, opt.id);
            toast("Pulsante rimosso.");
            refresh();
          });
          chip.appendChild(del);
        }

        chip.addEventListener("click", () => {
          onToggle(cat2.id, opt.id);
          // Full redraw (not just this chip's own class): an exclusive
          // toggle can deselect a DIFFERENT chip in the same category, and
          // that chip needs its "selected" class cleared too, or the UI
          // shows two contradictory choices highlighted at once.
          refresh();
        });
        grid.appendChild(chip);
      });

      if (stepKey) {
        const addTile = document.createElement("button");
        addTile.type = "button";
        addTile.className = "chip chip-add";
        addTile.innerHTML = `<span class="chip-it">➕ Aggiungi</span><span class="chip-en">crea il tuo</span>`;
        addTile.addEventListener("click", async () => {
          const result = await openCustomOptionDialog({ categoryName: cat2.name });
          if (!result) return;
          addCustomOption(stepKey, cat2.id, result);
          toast(`Pulsante "${result.label}" creato.`);
          refresh();
        });
        grid.appendChild(addTile);
      }
    }

    drawGrid(applyFilter(cat));
  });
}

function getFreshCategory(stepKey, categoryId, fallback) {
  const fresh = getCategoriesFor(stepKey).find((c) => c.id === categoryId);
  return fresh || fallback;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * A labeled free-text field with mic dictation + clear, inside a card.
 * @param {boolean} [translate] when set, the field is auto-translated
 * IT->EN a moment after the user stops typing/dictating (debounced) or on
 * blur — this is what actually goes in the tag-based prompt, shown live
 * so the user can see and trust it instead of getting a mixed-language
 * prompt with no warning.
 * @param {string} [translatedValue] the last known translated value, so a
 * re-render (e.g. navigating back to this step) shows it immediately.
 * @param {(enText:string)=>void} [onTranslated] called with the English
 * result ("" on failure/empty, so the caller falls back to raw text).
 */
export function renderCustomTextField(container, { label, placeholder, value, onChange, multiline = false, translate = false, translatedValue = "", onTranslated } = {}) {
  const card = document.createElement("div");
  card.className = "card";
  const title = document.createElement("h3");
  title.textContent = label;
  card.appendChild(title);

  const input = document.createElement(multiline ? "textarea" : "input");
  if (!multiline) input.type = "text";
  input.placeholder = placeholder || "";
  input.value = value || "";
  input.rows = multiline ? 3 : undefined;

  input.addEventListener("input", () => onChange(input.value));

  const row = buildDictationRow(input, onChange);
  card.appendChild(row);

  if (translate) {
    const status = document.createElement("div");
    status.className = "faint";
    status.style.cssText = "margin-top:6px;min-height:16px;";
    card.appendChild(status);

    function showTranslated(text) {
      status.innerHTML = text
        ? `→ nel prompt: <span style="color:var(--gold-soft);">${escapeHtml(text)}</span>`
        : "";
    }
    showTranslated(translatedValue);

    let debounceTimer = null;
    async function runTranslate() {
      const text = input.value.trim();
      if (!text) { showTranslated(""); if (onTranslated) onTranslated(""); return; }
      status.textContent = "🔄 Traduzione in corso...";
      const translated = await translateItToEn(text);
      if (input.value.trim() !== text) return; // stale — user kept typing meanwhile
      if (translated) {
        showTranslated(translated);
        if (onTranslated) onTranslated(translated);
      } else {
        status.textContent = "⚠️ Traduzione automatica non riuscita: nel prompt finirà il testo così com'è, in italiano.";
        if (onTranslated) onTranslated("");
      }
    }
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      status.textContent = "";
      debounceTimer = setTimeout(runTranslate, 900);
    });
    input.addEventListener("blur", () => { clearTimeout(debounceTimer); runTranslate(); });
  }

  container.appendChild(card);
  return input;
}
