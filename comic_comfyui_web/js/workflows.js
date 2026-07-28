import { db } from "./db.js";
import { qs, el, uid, toast, formatDate } from "./utils.js";
import { getActiveWorkflowId, setActiveWorkflowId } from "./state.js";

const STORE = "workflows";
const ROLES = [
  { key: "positive", label: "Prompt positivo", defaultField: "text" },
  { key: "negative", label: "Prompt negativo", defaultField: "text" },
  { key: "image", label: "Immagine di riferimento", defaultField: "image" },
  { key: "seed", label: "Seed", defaultField: "seed" },
];

let cache = [];
let mappingWorkflowId = null;

// A proper ComfyUI *API-format* workflow is a flat object keyed by node id,
// where every value is a { class_type, inputs, ... } node object. A regular
// (non-API) workflow save instead has top-level "nodes"/"links" arrays and
// other non-node fields (e.g. last_node_id: 25) — that shape passes a loose
// "is it an object" check but crashes ComfyUI's /prompt endpoint later with
// a cryptic server-side TypeError, since it isn't built to run directly.
function isValidWorkflowJson(json) {
  if (!json || typeof json !== "object" || Array.isArray(json) || Object.keys(json).length === 0) return false;
  if (Array.isArray(json.nodes) || Array.isArray(json.links)) return false;
  return Object.values(json).every(
    (node) => node && typeof node === "object" && !Array.isArray(node) && "class_type" in node && "inputs" in node
  );
}

async function loadAll() {
  cache = await db.getAll(STORE);
  cache.sort((a, b) => b.createdAt - a.createdAt);
  return cache;
}

export async function getWorkflowById(id) {
  return cache.find((w) => w.id === id) || db.get(STORE, id);
}

export async function getActiveWorkflow() {
  const id = getActiveWorkflowId();
  if (!id) return null;
  return getWorkflowById(id);
}

function nodeOptionsLabel(nodeId, node) {
  const title = node?._meta?.title;
  return `#${nodeId} · ${node?.class_type || "?"}${title ? " (" + title + ")" : ""}`;
}

function renderMappingPanel(workflow) {
  const panel = qs("#workflow-mapping");
  const fieldsRoot = qs("#mapping-fields");
  qs("#mapping-workflow-name").textContent = workflow.name;
  fieldsRoot.innerHTML = "";

  const nodeEntries = Object.entries(workflow.json);

  for (const role of ROLES) {
    const current = workflow.mapping?.[role.key] || {};
    const nodeSelect = el("select", { "data-role": role.key, "data-part": "node" }, [
      el("option", { value: "" }, "— non usato —"),
      ...nodeEntries.map(([nodeId, node]) =>
        el(
          "option",
          { value: nodeId, selected: current.nodeId === nodeId ? "selected" : false },
          nodeOptionsLabel(nodeId, node)
        )
      ),
    ]);
    const fieldInput = el("input", {
      type: "text",
      "data-role": role.key,
      "data-part": "field",
      value: current.field || role.defaultField,
      placeholder: role.defaultField,
    });
    fieldsRoot.appendChild(
      el("label", {}, [role.label, nodeSelect, fieldInput])
    );
  }

  mappingWorkflowId = workflow.id;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveMapping() {
  if (!mappingWorkflowId) return;
  const workflow = await getWorkflowById(mappingWorkflowId);
  if (!workflow) return;
  const mapping = {};
  for (const role of ROLES) {
    const nodeSelect = qs(`select[data-role="${role.key}"][data-part="node"]`);
    const fieldInput = qs(`input[data-role="${role.key}"][data-part="field"]`);
    const nodeId = nodeSelect?.value || "";
    const field = fieldInput?.value?.trim() || role.defaultField;
    if (nodeId) mapping[role.key] = { nodeId, field };
  }
  workflow.mapping = mapping;
  await db.put(STORE, workflow);
  await loadAll();
  renderList();
  toast("Mappatura salvata.", "success");
  qs("#workflow-mapping").hidden = true;
}

function renderList() {
  const root = qs("#workflow-list");
  root.innerHTML = "";
  const activeId = getActiveWorkflowId();

  if (cache.length === 0) {
    root.appendChild(el("p", { class: "hint" }, "Nessun workflow caricato."));
    return;
  }

  for (const workflow of cache) {
    const isActive = workflow.id === activeId;
    const nodeCount = Object.keys(workflow.json || {}).length;
    const card = el("div", { class: `item-card${isActive ? " active-workflow" : ""}` }, [
      el("div", { class: "name", text: workflow.name }),
      el("div", { class: "meta", text: `${nodeCount} nodi · ${formatDate(workflow.createdAt)}` }),
      el("div", { class: "meta", text: isActive ? "✅ Attivo" : "" }),
      el("div", { class: "row" }, [
        el("button", {
          class: "btn small",
          type: "button",
          onclick: () => {
            setActiveWorkflowId(workflow.id);
            renderList();
            toast(`"${workflow.name}" impostato come workflow attivo.`, "success");
          },
        }, isActive ? "Attivo" : "Seleziona"),
        el("button", {
          class: "btn small",
          type: "button",
          onclick: () => renderMappingPanel(workflow),
        }, "Mappa nodi"),
        el("button", {
          class: "btn small danger",
          type: "button",
          onclick: () => removeWorkflow(workflow.id),
        }, "Elimina"),
      ]),
    ]);
    root.appendChild(card);
  }
}

async function removeWorkflow(id) {
  await db.remove(STORE, id);
  if (getActiveWorkflowId() === id) setActiveWorkflowId(null);
  await loadAll();
  renderList();
  toast("Workflow eliminato.", "info");
}

async function handleUpload(fileList) {
  for (const file of Array.from(fileList)) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast(`${file.name}: formato non valido, atteso .json`, "error");
      continue;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!isValidWorkflowJson(json)) {
        toast(
          `${file.name}: non è nel formato API di ComfyUI. In ComfyUI usa "Export (API)" (o "Save (API Format)" con Dev Mode attiva), non il salvataggio normale del workflow.`,
          "error",
          9000
        );
        continue;
      }
      const record = {
        id: uid(),
        name: file.name.replace(/\.json$/i, ""),
        json,
        mapping: {},
        createdAt: Date.now(),
      };
      await db.put(STORE, record);
      toast(`Workflow "${record.name}" caricato.`, "success");
    } catch (err) {
      toast(`${file.name}: errore nel parsing JSON (${err.message}).`, "error");
    }
  }
  await loadAll();
  renderList();
}

export async function initWorkflows() {
  await loadAll();
  renderList();

  qs("#workflow-upload").addEventListener("change", (e) => {
    if (e.target.files?.length) handleUpload(e.target.files);
    e.target.value = "";
  });

  qs("#mapping-save").addEventListener("click", saveMapping);
}

export function listWorkflows() {
  return cache;
}
