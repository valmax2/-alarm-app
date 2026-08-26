// ==========================================================================
// state.js — central project state + prompt assembly engine.
//
// Holds ONE "project in progress" (Module 1) in memory, persisted to
// localStorage on every change, plus a small pub-sub so UI modules can
// re-render reactively. Saved characters/projects/reference-packs are kept
// as separate collections (see gallery.js for the CRUD screens).
// ==========================================================================

import { lsGet, lsSet, uid } from "./storage.js";
import { getBodyCategories } from "./data/body.js";
import { anatomyCategories } from "./data/anatomy.js";
import { faceCategories, buildIdentityLockFragments } from "./data/face.js";
import { hairCategories, buildKeepReferenceHairFragment } from "./data/hair.js";
import { actionCategories, poseCategories } from "./data/actionsPoses.js";
import { clothingCategories } from "./data/clothing.js";
import { sceneCategories } from "./data/scenes.js";
import { cameraCategories, lightCategories } from "./data/cameraLight.js";
import { negativeCategories, defaultNegativePrompt } from "./data/negative.js";
import { getCustomOptions } from "./modules/customOptions.js";

const PROJECT_KEY = "current_project";

function blankProject() {
  return {
    id: uid("proj"),
    name: "Nuovo progetto",
    createdAt: Date.now(),
    updatedAt: Date.now(),

    persona: null, // 'donna' | 'uomo'

    // selections[stepKey][categoryId] = [optionId, ...]
    selections: {
      body: {},
      clothing: {},
      face: {},
      hair: {},
      action: {},
      pose: {},
      scene: {},
      camera: {},
      light: {},
    },

    faceMode: null, // 'create' | 'reference'
    referenceImageId: null, // IndexedDB image id (Step 3 reference photo)
    identityLock: true,

    hairMode: null, // 'keep' | 'change' (only asked when a reference exists)
    customHair: "",

    customAction: "",
    customScene: "",

    negativeText: defaultNegativePrompt(),
    positiveManualText: null, // set once the user hand-edits the box directly
    positiveManualBaseline: null, // auto-prompt snapshot at the moment manual mode started

    destination: null, // 'comfyui' | 'chatgpt' | 'gemini' | 'metaai'

    referencePack: [], // [{id, label, imageId}]
  };
}

let project = lsGet(PROJECT_KEY) || blankProject();
const listeners = new Set();

function persist() {
  project.updatedAt = Date.now();
  lsSet(PROJECT_KEY, project);
  listeners.forEach((fn) => fn(project));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getProject() {
  return project;
}

export function resetProject() {
  project = blankProject();
  persist();
}

export function loadProjectObject(p) {
  project = p;
  persist();
}

export function setPersona(persona) {
  project.persona = persona;
  persist();
}

export function toggleSelection(stepKey, categoryId, optionId, { exclusive = false } = {}) {
  const bucket = project.selections[stepKey] || (project.selections[stepKey] = {});
  const current = bucket[categoryId] || [];
  let next;
  if (current.includes(optionId)) {
    next = current.filter((id) => id !== optionId);
  } else {
    next = exclusive ? [optionId] : [...current, optionId];
  }
  bucket[categoryId] = next;
  persist();
}

export function isSelected(stepKey, categoryId, optionId) {
  const bucket = project.selections[stepKey] || {};
  return (bucket[categoryId] || []).includes(optionId);
}

// The 5 horizontal "punto_vista" ids that the Step 7 orbit widget drives.
// Elevation options in the same category (low_angle, dal_basso, ...) and any
// custom ones the user adds are left untouched when the widget commits.
export const CAMERA_YAW_IDS = ["frontale", "tre_quarti_sx", "tre_quarti_dx", "profilo", "posteriore"];

/** Set which of the 5 orbit-widget presets is active, without disturbing
 * any elevation option also selected in "punto_vista". */
export function setCameraOrbitAngle(optionId) {
  const bucket = project.selections.camera || (project.selections.camera = {});
  const current = bucket.punto_vista || [];
  const kept = current.filter((id) => !CAMERA_YAW_IDS.includes(id));
  bucket.punto_vista = [...kept, optionId];
  persist();
}

/** Currently active orbit-widget preset id, if any. */
export function getCameraOrbitAngle() {
  const bucket = project.selections.camera || {};
  const current = bucket.punto_vista || [];
  return current.find((id) => CAMERA_YAW_IDS.includes(id)) || null;
}

// The 4 vertical-height presets driven by the Step 7 lateral (side) view
// widget. "Eye level" is represented by none of these being selected.
export const CAMERA_ELEVATION_IDS = ["dal_basso", "low_angle", "high_angle", "top_down"];

/** Set the active height/elevation preset (or null for eye level), without
 * disturbing yaw, dutch_angle or any custom option in "punto_vista". */
export function setCameraElevation(optionId) {
  const bucket = project.selections.camera || (project.selections.camera = {});
  const current = bucket.punto_vista || [];
  const kept = current.filter((id) => !CAMERA_ELEVATION_IDS.includes(id));
  bucket.punto_vista = optionId ? [...kept, optionId] : kept;
  persist();
}

/** Currently active height/elevation preset id, or null (eye level). */
export function getCameraElevation() {
  const bucket = project.selections.camera || {};
  const current = bucket.punto_vista || [];
  return current.find((id) => CAMERA_ELEVATION_IDS.includes(id)) || null;
}

// The 2 zoom presets driven by the Step 7 zoom dial (mutually exclusive —
// a lens can't be zoomed in and out at once). "Neutral" = neither selected.
export const CAMERA_ZOOM_IDS = ["zoom_in", "zoom_out"];

/** Set the active zoom preset (or null for neutral), without disturbing
 * distanza_ravvicinata/media/ampia, orbit, tilt, sguardo_* or any custom
 * option in "obiettivo". */
export function setCameraZoom(optionId) {
  const bucket = project.selections.camera || (project.selections.camera = {});
  const current = bucket.obiettivo || [];
  const kept = current.filter((id) => !CAMERA_ZOOM_IDS.includes(id));
  bucket.obiettivo = optionId ? [...kept, optionId] : kept;
  persist();
}

/** Currently active zoom preset id, or null (neutral). */
export function getCameraZoom() {
  const bucket = project.selections.camera || {};
  const current = bucket.obiettivo || [];
  return current.find((id) => CAMERA_ZOOM_IDS.includes(id)) || null;
}

export function setFaceMode(mode) {
  project.faceMode = mode;
  persist();
}

export function setReferenceImage(imageId) {
  project.referenceImageId = imageId;
  persist();
}

export function setIdentityLock(v) {
  project.identityLock = v;
  persist();
}

export function setHairMode(mode) {
  project.hairMode = mode;
  persist();
}

export function setCustomField(field, value) {
  project[field] = value;
  persist();
}

export function setDestination(dest) {
  project.destination = dest;
  persist();
}

export function setNegativeText(text) {
  project.negativeText = text;
  persist();
}

export function setPositiveManualText(text) {
  if (project.positiveManualText == null) {
    // just entering manual mode: remember what the auto-generated prompt
    // looked like at this moment, so we can later tell whether the wizard
    // has moved on (new selections) since the user started hand-editing.
    project.positiveManualBaseline = buildAutoPositivePrompt();
  }
  project.positiveManualText = text;
  persist();
}

export function clearPositiveManualOverride() {
  project.positiveManualText = null;
  project.positiveManualBaseline = null;
  persist();
}

/**
 * True when the user is hand-editing the positive prompt AND the wizard
 * selections have changed since they started (e.g. they went back to an
 * earlier step and added something) — so the box on screen no longer
 * reflects those newer choices. Used to surface a visible warning instead
 * of silently dropping the user's later edits elsewhere in the wizard.
 */
export function isPositivePromptStale() {
  return (
    project.positiveManualText != null &&
    project.positiveManualBaseline != null &&
    buildAutoPositivePrompt() !== project.positiveManualBaseline
  );
}

export function toggleNegativeFragment(frag) {
  const parts = (project.negativeText || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const idx = parts.findIndex((p) => p.toLowerCase() === frag.toLowerCase());
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(frag);
  project.negativeText = parts.join(", ");
  persist();
}

export function isNegativeFragmentActive(frag) {
  const parts = (project.negativeText || "").split(",").map((s) => s.trim().toLowerCase());
  return parts.includes(frag.toLowerCase());
}

// ---------------- Category lookups (persona-aware) ----------------

function baseCategoriesFor(stepKey) {
  switch (stepKey) {
    case "body": return [...getBodyCategories(project.persona || "donna"), ...anatomyCategories];
    case "clothing": return clothingCategories;
    case "face": return faceCategories;
    case "hair": return hairCategories;
    case "action": return actionCategories;
    case "pose": return poseCategories;
    case "scene": return sceneCategories;
    case "camera": return cameraCategories;
    case "light": return lightCategories;
    case "negative": return negativeCategories;
    default: return [];
  }
}

/**
 * Categories for a step, with the user's own custom buttons
 * (see modules/customOptions.js) merged into each category's option list.
 * Never mutates the underlying data/*.js arrays.
 */
export function getCategoriesFor(stepKey) {
  return baseCategoriesFor(stepKey).map((cat) => ({
    ...cat,
    options: [...cat.options, ...getCustomOptions(stepKey, cat.id)],
  }));
}

function fragmentsFor(stepKey) {
  const cats = getCategoriesFor(stepKey);
  const bucket = project.selections[stepKey] || {};
  const out = [];
  cats.forEach((cat) => {
    const ids = bucket[cat.id] || [];
    ids.forEach((id) => {
      const opt = cat.options.find((o) => o.id === id);
      if (opt) out.push(opt.frag);
    });
  });
  return out;
}

const PERSONA_SUBJECT = { donna: "1woman", uomo: "1man" };

/** Builds the auto-generated positive prompt from all wizard selections. */
export function buildAutoPositivePrompt() {
  const parts = [];
  if (project.persona) parts.push(PERSONA_SUBJECT[project.persona]);

  parts.push(...fragmentsFor("body"));
  parts.push(...fragmentsFor("clothing"));

  if (project.faceMode === "reference" && project.referenceImageId) {
    parts.push(...buildIdentityLockFragments());
    if (!project.identityLock) {
      // identity lock off: keep a lighter reference note only
      parts.splice(parts.length - buildIdentityLockFragments().length, buildIdentityLockFragments().length,
        "inspired by reference image");
    }
  } else if (project.faceMode === "create") {
    parts.push(...fragmentsFor("face"));
  }

  if (project.referenceImageId && project.hairMode === "keep") {
    parts.push(...buildKeepReferenceHairFragment());
  } else {
    parts.push(...fragmentsFor("hair"));
  }
  if (project.customHair && project.customHair.trim()) parts.push(project.customHair.trim());

  parts.push(...fragmentsFor("action"));
  if (project.customAction && project.customAction.trim()) parts.push(project.customAction.trim());
  parts.push(...fragmentsFor("pose"));

  parts.push(...fragmentsFor("scene"));
  if (project.customScene && project.customScene.trim()) parts.push(project.customScene.trim());

  parts.push(...fragmentsFor("camera"));
  parts.push(...fragmentsFor("light"));

  return parts.filter(Boolean).join(", ");
}

export function getPositivePrompt() {
  return project.positiveManualText != null ? project.positiveManualText : buildAutoPositivePrompt();
}

export function getNegativePrompt() {
  return project.negativeText || "";
}

/** Human-readable list of chosen fragments, grouped, for the compact prompt bar. */
export function getPromptBarSummary() {
  const order = ["body", "clothing", "face", "hair", "action", "pose", "scene", "camera", "light"];
  const tags = [];
  order.forEach((stepKey) => tags.push(...fragmentsFor(stepKey)));
  return tags;
}
