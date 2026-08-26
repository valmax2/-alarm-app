// ==========================================================================
// modules/workflowParams.js — reads/writes recognizable parameters out of a
// ComfyUI workflow saved in "API format" (a flat {nodeId: {class_type,
// inputs, _meta}} map — the format ComfyUI's own /prompt endpoint accepts,
// and what "Save (API Format)" produces from the ComfyUI UI).
//
// A workflow exported in the *other* ComfyUI format (the UI graph format,
// with top-level "nodes"/"links" arrays) is detected and flagged instead of
// guessed at — see isApiFormat().
// ==========================================================================

export function isApiFormat(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  if (Array.isArray(json.nodes)) return false; // UI graph format
  return Object.values(json).every((n) => n && typeof n === "object" && "class_type" in n);
}

function title(node) {
  return (node._meta && node._meta.title) || node.class_type;
}

/**
 * Scans the workflow and returns every parameter type the editor can show
 * as a select/toggle/slider/field, grouped by kind.
 */
export function extractParams(workflow) {
  const result = {
    checkpoints: [], loras: [], vaes: [], textPrompts: [],
    samplers: [], latents: [], loadImages: [], other: [],
  };
  if (!isApiFormat(workflow)) return result;

  for (const [nodeId, node] of Object.entries(workflow)) {
    const type = node.class_type || "";
    const inputs = node.inputs || {};

    if (/CheckpointLoader/i.test(type)) {
      result.checkpoints.push({ nodeId, title: title(node), value: inputs.ckpt_name });
    } else if (/LoraLoader/i.test(type)) {
      result.loras.push({
        nodeId, title: title(node), value: inputs.lora_name,
        strengthModel: inputs.strength_model, strengthClip: inputs.strength_clip,
      });
    } else if (/VAELoader/i.test(type)) {
      result.vaes.push({ nodeId, title: title(node), value: inputs.vae_name });
    } else if (/CLIPTextEncode/i.test(type)) {
      const t = title(node).toLowerCase();
      let role = "unknown";
      if (t.includes("negative") || t.includes("negativo")) role = "negative";
      else if (t.includes("positive") || t.includes("positivo")) role = "positive";
      result.textPrompts.push({ nodeId, title: title(node), text: inputs.text, role });
    } else if (/KSampler/i.test(type)) {
      result.samplers.push({
        nodeId, title: title(node),
        seed: inputs.seed, steps: inputs.steps, cfg: inputs.cfg,
        denoise: inputs.denoise, sampler_name: inputs.sampler_name, scheduler: inputs.scheduler,
      });
    } else if (/EmptyLatentImage/i.test(type)) {
      result.latents.push({ nodeId, title: title(node), width: inputs.width, height: inputs.height, batch_size: inputs.batch_size });
    } else if (/LoadImage/i.test(type)) {
      result.loadImages.push({ nodeId, title: title(node), value: inputs.image });
    } else {
      result.other.push({ nodeId, title: title(node), type });
    }
  }

  // If exactly two unresolved text prompts, assume first=positive, second=negative
  const unresolved = result.textPrompts.filter((p) => p.role === "unknown");
  if (unresolved.length === 2) {
    unresolved[0].role = "positive";
    unresolved[1].role = "negative";
  }

  return result;
}

export function setNodeInput(workflow, nodeId, field, value) {
  if (!workflow[nodeId]) return;
  workflow[nodeId].inputs = workflow[nodeId].inputs || {};
  workflow[nodeId].inputs[field] = value;
}

export function findImageNodes(workflow) {
  if (!isApiFormat(workflow)) return [];
  return Object.entries(workflow)
    .filter(([, node]) => /LoadImage/i.test(node.class_type || ""))
    .map(([nodeId, node]) => ({ nodeId, title: title(node), value: (node.inputs || {}).image }));
}
