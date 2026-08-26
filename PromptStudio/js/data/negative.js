// ==========================================================================
// data/negative.js — STEP 8: libreria di elementi negativi comuni.
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

export const negativeCategories = [
  {
    id: "anatomia", name: "Anatomia",
    options: opts([
      ["bad_anatomy", "Anatomia scorretta", "bad anatomy"],
      ["deformed_hands", "Mani deformate", "deformed hands"],
      ["extra_fingers", "Dita in più", "extra fingers"],
      ["missing_fingers", "Dita mancanti", "missing fingers"],
      ["fused_fingers", "Dita fuse", "fused fingers"],
      ["extra_limbs", "Arti in più", "extra limbs"],
      ["missing_limbs", "Arti mancanti", "missing limbs"],
      ["duplicate_subject", "Soggetto duplicato", "duplicate subject"],
      ["mutated", "Corpo mutato", "mutated body"],
      ["long_neck", "Collo allungato", "long neck"],
    ]),
  },
  {
    id: "volto", name: "Volto",
    options: opts([
      ["distorted_face", "Volto distorto", "distorted face"],
      ["asymmetrical_eyes", "Occhi asimmetrici", "asymmetrical eyes"],
      ["cropped_head", "Testa tagliata", "cropped head"],
      ["extra_eyes", "Occhi in più", "extra eyes"],
      ["bad_teeth", "Denti malformati", "bad teeth"],
    ]),
  },
  {
    id: "qualita", name: "Qualità immagine",
    options: opts([
      ["blurry", "Sfocato", "blurry"],
      ["low_quality", "Bassa qualità", "low quality"],
      ["worst_quality", "Qualità pessima", "worst quality"],
      ["jpeg_artifacts", "Artefatti JPEG", "jpeg artifacts"],
      ["grainy", "Granuloso", "grainy"],
      ["out_of_focus", "Fuori fuoco", "out of focus"],
      ["overexposed", "Sovraesposto", "overexposed"],
      ["underexposed", "Sottoesposto", "underexposed"],
    ]),
  },
  {
    id: "elementi_indesiderati", name: "Elementi indesiderati",
    options: opts([
      ["watermark", "Watermark", "watermark"],
      ["signature", "Firma", "signature"],
      ["text", "Testo", "text"],
      ["logo", "Logo", "logo"],
      ["frame", "Cornice", "frame border"],
      ["cartoon", "Stile cartoon (se non voluto)", "cartoon style"],
      ["3d_render", "Render 3D (se non voluto)", "3d render"],
    ]),
  },
];

/** Baseline negative prompt applied by default (still fully editable). */
export function defaultNegativePrompt() {
  return [
    "bad anatomy", "deformed hands", "extra fingers", "missing fingers",
    "extra limbs", "duplicate subject", "distorted face", "asymmetrical eyes",
    "cropped head", "blurry", "low quality", "jpeg artifacts", "watermark",
    "signature", "text",
  ].join(", ");
}
