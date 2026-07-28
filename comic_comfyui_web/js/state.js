const SETTINGS_KEY = "comic-studio:connection";
const ACTIVE_WORKFLOW_KEY = "comic-studio:active-workflow";

const listeners = new Set();

function notify(event, payload) {
  for (const fn of listeners) fn(event, payload);
}

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getConnectionSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConnectionSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  notify("connection-updated", settings);
}

export function clearConnectionSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  notify("connection-updated", null);
}

export function getActiveWorkflowId() {
  return localStorage.getItem(ACTIVE_WORKFLOW_KEY) || null;
}

export function setActiveWorkflowId(id) {
  if (id) localStorage.setItem(ACTIVE_WORKFLOW_KEY, id);
  else localStorage.removeItem(ACTIVE_WORKFLOW_KEY);
  notify("active-workflow-updated", id);
}

export function baseUrlFromSettings(settings) {
  if (!settings?.ip || !settings?.port) return null;
  return `${settings.protocol || "http"}://${settings.ip}:${settings.port}`;
}
