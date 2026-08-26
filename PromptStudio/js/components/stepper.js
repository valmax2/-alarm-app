// ==========================================================================
// components/stepper.js — reusable pieces for the Module 1 wizard:
// step progress dots, collapsible category accordions with chip grids, and
// a labeled custom-text field with dictation.
// ==========================================================================

import { buildDictationRow } from "./voice.js";

export function renderStepProgress(container, currentIndex, total) {
  const wrap = document.createElement("div");
  wrap.className = "step-progress";
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("div");
    dot.className = "step-dot" + (i < currentIndex ? " done" : i === currentIndex ? " active" : "");
    wrap.appendChild(dot);
  }
  container.appendChild(wrap);
}

/**
 * Renders a list of categories as collapsible accordions of chip options.
 * @param {HTMLElement} container
 * @param {Array} categories - [{id, name, options:[{id,label,frag}]}]
 * @param {(categoryId:string, optionId:string)=>void} onToggle
 * @param {(categoryId:string, optionId:string)=>boolean} isSelected
 * @param {(categoryId:string)=>number} [selectedCount]
 * @param {Set<string>} [openByDefault] category ids to render expanded initially
 */
export function renderCategoryAccordions(container, categories, { onToggle, isSelected, openByDefault } = {}) {
  categories.forEach((cat, idx) => {
    const box = document.createElement("div");
    box.className = "category" + (openByDefault && openByDefault.has(cat.id) ? " open" : idx === 0 ? " open" : "");

    const head = document.createElement("div");
    head.className = "category-head";
    const selCount = cat.options.filter((o) => isSelected(cat.id, o.id)).length;
    head.innerHTML = `<span class="name">${cat.name}${selCount ? `<span class="category-badge">${selCount}</span>` : ""}</span><span class="chev">▶</span>`;
    head.addEventListener("click", () => box.classList.toggle("open"));

    const body = document.createElement("div");
    body.className = "category-body";
    const grid = document.createElement("div");
    grid.className = "chip-grid";

    cat.options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (isSelected(cat.id, opt.id) ? " selected" : "");
      chip.textContent = opt.label;
      chip.addEventListener("click", () => {
        onToggle(cat.id, opt.id);
        chip.classList.toggle("selected");
        const count = cat.options.filter((o) => isSelected(cat.id, o.id)).length;
        const badge = head.querySelector(".category-badge");
        if (count) {
          if (badge) badge.textContent = String(count);
          else head.querySelector(".name").insertAdjacentHTML("beforeend", `<span class="category-badge">${count}</span>`);
        } else if (badge) {
          badge.remove();
        }
      });
      grid.appendChild(chip);
    });

    body.appendChild(grid);
    box.appendChild(head);
    box.appendChild(body);
    container.appendChild(box);
  });
}

/** A labeled free-text field with mic dictation + clear, inside a card. */
export function renderCustomTextField(container, { label, placeholder, value, onChange, multiline = false }) {
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
  container.appendChild(card);
  return input;
}
