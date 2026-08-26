// ==========================================================================
// modules/compat.js — best-effort model-family detection + compatibility
// badge logic (VERDE / ROSSO / GIALLO). Per spec: never claim "compatible"
// on a pure guess — GIALLO ("non determinabile") is the honest default when
// evidence is thin.
// ==========================================================================

const FAMILY_PATTERNS = [
  { family: "FLUX", patterns: [/flux/i, /\bfl1\b/i] },
  {
    family: "SDXL",
    // "XL" alone (JuggernautXL, epicrealismXL...) is the community's most
    // common way to name an SDXL checkpoint — catch it as a suffix/word
    // chunk, not just the explicit "sdxl"/"xl base"/"xl turbo" spellings.
    patterns: [/sdxl/i, /xl[-_. ]?base/i, /xl[-_. ]?turbo/i, /pony/i, /xl(?=[-_. ]|$)/i],
  },
  { family: "SD 1.5", patterns: [/\bsd1[-_. ]?5\b/i, /\bsd15\b/i, /v1-5/i] },
  { family: "WAN", patterns: [/\bwan\b/i, /wan2[-_.]?[12]/i] },
  { family: "Qwen", patterns: [/qwen/i] },
];

/**
 * Guesses a model family from filename/path/metadata hints.
 * Returns { family, confidence: 'high'|'low' } — 'unknown' family + 'low'
 * confidence when nothing matches, never a guessed "compatible".
 */
export function detectFamily({ name = "", path = "", metadata = {} } = {}) {
  const haystack = `${name} ${path}`.toLowerCase();

  // Strong evidence: explicit metadata field written by the training/export tool.
  if (metadata && metadata.base_model) {
    const meta = String(metadata.base_model);
    for (const { family, patterns } of FAMILY_PATTERNS) {
      if (patterns.some((re) => re.test(meta))) {
        return { family, confidence: "high" };
      }
    }
  }

  for (const { family, patterns } of FAMILY_PATTERNS) {
    if (patterns.some((re) => re.test(haystack))) {
      return { family, confidence: "high" };
    }
  }

  return { family: "unknown", confidence: "low" };
}

/**
 * Compares two detected families (e.g. a checkpoint and a LoRA, or a
 * checkpoint and the workflow it's loaded into) and returns a badge state.
 */
export function compareCompatibility(a, b) {
  if (!a || !b || a.family === "unknown" || b.family === "unknown") {
    return { level: "yellow", reason: "Compatibilità non determinabile: dati insufficienti." };
  }
  if (a.family === b.family) {
    return { level: "green", reason: `Entrambi rilevati come ${a.family}.` };
  }
  return { level: "red", reason: `Famiglie diverse: ${a.family} vs ${b.family}.` };
}

export function badgeLabel(level) {
  return { green: "Compatibile", red: "Incompatibile", yellow: "Non determinabile" }[level] || "Non determinabile";
}
