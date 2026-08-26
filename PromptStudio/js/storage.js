// ==========================================================================
// storage.js — persistence layer
//
// Two tiers:
//  - localStorage: lightweight JSON (projects, characters metadata, settings)
//  - IndexedDB:     binary image blobs (reference photos, generated images,
//                    reference pack) — localStorage's ~5MB quota is not
//                    enough for photos, so blobs live in IndexedDB and are
//                    referenced by id from the JSON records.
// ==========================================================================

const DB_NAME = "prompt-studio";
const DB_VERSION = 1;
const STORE_IMAGES = "images";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Store a File/Blob as an image record. Returns the generated id.
 * meta: { name, kind, characterId, createdAt } — freeform.
 */
export async function saveImageBlob(blob, meta = {}) {
  const db = await openDb();
  const id = uid("img");
  const record = { id, blob, meta: { ...meta, createdAt: Date.now() } };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readwrite");
    tx.objectStore(STORE_IMAGES).put(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImageRecord(id) {
  if (!id) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readonly");
    const req = tx.objectStore(STORE_IMAGES).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Privacy (eye) toggle, stored on the image itself — not on whatever
 * character/project/screen happens to reference it — so hiding an image
 * in one place hides it everywhere it's shown, and it stays hidden across
 * reloads and between screens.
 */
export async function setImageHidden(id, hidden) {
  const rec = await getImageRecord(id);
  if (!rec) return;
  rec.meta = { ...rec.meta, hidden };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readwrite");
    tx.objectStore(STORE_IMAGES).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function isImageHidden(id) {
  if (!id) return false;
  const rec = await getImageRecord(id);
  return !!(rec && rec.meta && rec.meta.hidden);
}

/** Returns an object URL for the image (caller may revoke it later). */
export async function getImageUrl(id) {
  const rec = await getImageRecord(id);
  if (!rec) return null;
  return URL.createObjectURL(rec.blob);
}

export async function deleteImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readwrite");
    tx.objectStore(STORE_IMAGES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listImages() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, "readonly");
    const req = tx.objectStore(STORE_IMAGES).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- localStorage JSON helpers ----------------

const LS_PREFIX = "promptstudio:";

export function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("lsGet failed", key, e);
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("lsSet failed (quota?)", key, e);
    return false;
  }
}

export function lsRemove(key) {
  localStorage.removeItem(LS_PREFIX + key);
}
