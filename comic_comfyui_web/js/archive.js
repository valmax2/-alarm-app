import { db } from "./db.js";
import { qs, el, uid, toast, formatBytes, formatDate, downloadBlob, sanitizeFilename, thumbWithPrivacyToggle } from "./utils.js";

const STORE = "images";

let cache = [];

async function loadAll() {
  cache = await db.getAll(STORE);
  cache.sort((a, b) => b.createdAt - a.createdAt);
  return cache;
}

export async function addArchiveImage(blob, meta = {}) {
  const record = {
    id: uid(),
    name: meta.name || `comic-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`,
    blob,
    prompt: meta.prompt || "",
    workflowName: meta.workflowName || "",
    private: false,
    active: true,
    createdAt: Date.now(),
  };
  await db.put(STORE, record);
  await loadAll();
  renderGrid();
  return record;
}

function matchesFilters(record) {
  const onlyActive = qs("#archive-filter-active").checked;
  const onlyPrivate = qs("#archive-filter-private").checked;
  if (onlyActive && !record.active) return false;
  if (onlyPrivate && !record.private) return false;
  return true;
}

async function toggleField(record, field) {
  record[field] = !record[field];
  await db.put(STORE, record);
  renderGrid();
}

async function removeImage(id) {
  await db.remove(STORE, id);
  await loadAll();
  renderGrid();
  toast("Immagine eliminata dall'archivio.", "info");
}

function renderGrid() {
  const root = qs("#archive-grid");
  root.innerHTML = "";
  const visible = cache.filter(matchesFilters);

  if (visible.length === 0) {
    root.appendChild(el("p", { class: "hint" }, "Nessuna immagine in archivio."));
    return;
  }

  for (const record of visible) {
    const url = URL.createObjectURL(record.blob);
    const card = el("div", { class: "item-card" }, [
      thumbWithPrivacyToggle(url, record.name, !!record.private, () => toggleField(record, "private")),
      el("div", { class: "name", text: record.name }),
      el("div", { class: "meta", text: `${formatBytes(record.blob.size)} · ${formatDate(record.createdAt)}` }),
      record.workflowName ? el("div", { class: "meta", text: `Workflow: ${record.workflowName}` }) : null,
      el("div", { class: "row" }, [
        el("label", { class: "toggle" }, [
          el("input", {
            type: "checkbox",
            checked: record.active ? "checked" : false,
            onchange: () => toggleField(record, "active"),
          }),
          "Attiva",
        ]),
      ]),
      el("div", { class: "row" }, [
        el("button", {
          class: "btn small",
          type: "button",
          onclick: () => downloadBlob(record.blob, `${sanitizeFilename(record.name)}.png`),
        }, "Scarica"),
        el("button", {
          class: "btn small danger",
          type: "button",
          onclick: () => removeImage(record.id),
        }, "Elimina"),
      ]),
    ]);
    root.appendChild(card);
  }
}

export async function initArchive() {
  await loadAll();
  renderGrid();
  qs("#archive-filter-active").addEventListener("change", renderGrid);
  qs("#archive-filter-private").addEventListener("change", renderGrid);
}

export function refreshArchive() {
  renderGrid();
}
