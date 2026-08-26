// ==========================================================================
// modules/customOptions.js — persistente, per-categoria: i pulsanti che
// l'utente crea da sé (es. "capelli bianchi") restano disponibili come
// qualsiasi altro pulsante della libreria, in ogni progetto futuro.
// ==========================================================================

import { lsGet, lsSet, uid } from "../storage.js";

const KEY = "custom_options";

function getAll() { return lsGet(KEY, {}); }
function setAll(v) { lsSet(KEY, v); }

export function getCustomOptions(stepKey, categoryId) {
  const all = getAll();
  return (all[stepKey] && all[stepKey][categoryId]) || [];
}

export function addCustomOption(stepKey, categoryId, { label, frag }) {
  const all = getAll();
  all[stepKey] = all[stepKey] || {};
  all[stepKey][categoryId] = all[stepKey][categoryId] || [];
  const opt = { id: uid("custom"), label, frag, custom: true };
  all[stepKey][categoryId].push(opt);
  setAll(all);
  return opt;
}

export function removeCustomOption(stepKey, categoryId, optionId) {
  const all = getAll();
  if (!all[stepKey] || !all[stepKey][categoryId]) return;
  all[stepKey][categoryId] = all[stepKey][categoryId].filter((o) => o.id !== optionId);
  setAll(all);
}
