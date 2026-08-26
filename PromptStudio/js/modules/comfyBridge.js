// ==========================================================================
// modules/comfyBridge.js — HTTP client for the local Bridge (bridge/bridge_server.py).
//
// The Bridge runs on the user's PC (started via AVVIA_BRIDGE.bat) and is the
// only thing allowed to touch the filesystem / talk to the local ComfyUI
// server. This module never touches disk itself — every call is a fetch()
// to the Bridge's small REST API, scoped to the folders the user configured.
// ==========================================================================

import { lsGet, lsSet } from "../storage.js";

const CONFIG_KEY = "bridge_config";
const DEFAULT_BASE_URL = "http://127.0.0.1:8765";

export function getBridgeConfig() {
  return lsGet(CONFIG_KEY, {
    baseUrl: DEFAULT_BASE_URL,
    comfyRoot: "",
    personalRoot: "",
    connected: false,
  });
}

export function setBridgeConfig(patch) {
  const next = { ...getBridgeConfig(), ...patch };
  lsSet(CONFIG_KEY, next);
  return next;
}

function baseUrl() {
  return (getBridgeConfig().baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
}

async function req(path, opts = {}) {
  const res = await fetch(baseUrl() + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg || `Errore ${res.status}`);
  }
  return res;
}

export async function checkHealth() {
  try {
    const res = await req("/health");
    const json = await res.json();
    setBridgeConfig({ connected: true });
    return json;
  } catch (e) {
    setBridgeConfig({ connected: false });
    throw e;
  }
}

export async function pushConfigToBridge() {
  const cfg = getBridgeConfig();
  const res = await req("/config", {
    method: "POST",
    body: JSON.stringify({ comfy_root: cfg.comfyRoot, personal_root: cfg.personalRoot }),
  });
  return res.json();
}

export async function bridgeBrowse(root, path = "") {
  const res = await req(`/browse?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`);
  return res.json();
}

/** Direct URL to a file served by the Bridge — for <img src>, not a fetch(). */
export function getBridgeFileUrl(root, path) {
  return `${baseUrl()}/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`;
}

/** Fetches a file from the Bridge and returns it as a browser File object. */
export async function bridgeFetchFile(root, path) {
  const res = await req(`/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`);
  const blob = await res.blob();
  const name = path.split("/").pop();
  return new File([blob], name, { type: blob.type });
}

export async function fetchInventory() {
  const res = await req("/inventory");
  return res.json();
}

export async function rescanInventory() {
  const res = await req("/inventory/rescan", { method: "POST" });
  return res.json();
}

export async function listWorkflows() {
  const res = await req("/workflows");
  return res.json();
}

export async function getWorkflow(path) {
  const res = await req(`/workflow?path=${encodeURIComponent(path)}`);
  return res.json();
}

export async function saveWorkflowToLibrary(name, workflowJson) {
  const res = await req("/workflow/import", {
    method: "POST",
    body: JSON.stringify({ name, workflow: workflowJson }),
  });
  return res.json();
}

export async function deleteWorkflow(path) {
  const res = await req(`/workflow?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  return res.json();
}

export async function generateWorkflow(workflowJson) {
  const res = await req("/comfyui/generate", {
    method: "POST",
    body: JSON.stringify({ workflow: workflowJson }),
  });
  return res.json();
}

export async function getGenerationStatus(promptId) {
  const res = await req(`/comfyui/status?prompt_id=${encodeURIComponent(promptId)}`);
  return res.json();
}

/** Uploads a File/Blob straight into ComfyUI's own input/ folder via the Bridge. */
export async function uploadInputImage(file) {
  const res = await fetch(`${baseUrl()}/comfyui/input?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    body: file,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg || `Errore ${res.status}`);
  }
  return res.json();
}

export function getGeneratedImageUrl({ filename, subfolder = "", type = "output" }) {
  return `${baseUrl()}/comfyui/image?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
}
