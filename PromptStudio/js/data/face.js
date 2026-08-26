// ==========================================================================
// data/face.js — STEP 3: VOLTO library (path A: "crea il volto").
// Path B ("usa foto di riferimento") uses buildIdentityLockFragments() below
// instead of these chip categories.
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

export const faceCategories = [
  {
    id: "forma_volto", name: "Forma del volto",
    options: opts([
      ["ovale", "Ovale", "oval face shape"],
      ["tondo", "Tondo", "round face shape"],
      ["quadrato", "Quadrato", "square face shape"],
      ["cuore", "A cuore", "heart-shaped face"],
      ["allungato", "Allungato", "long face shape"],
      ["diamante", "A diamante", "diamond face shape"],
    ]),
  },
  {
    id: "eta_apparente", name: "Età apparente",
    options: opts([
      ["giovane_adulto", "Giovane adulto (20-29)", "in her/his twenties"],
      ["adulto", "Adulto (30-39)", "in her/his thirties"],
      ["maturo", "Maturo (40-49)", "in her/his forties"],
      ["anziano", "Più maturo (50+)", "mature adult, 50s"],
    ]),
  },
  {
    id: "occhi_forma", name: "Occhi — forma",
    options: opts([
      ["grandi", "Grandi", "large eyes"],
      ["a_mandorla", "A mandorla", "almond-shaped eyes"],
      ["piccoli", "Piccoli", "small eyes"],
      ["profondi", "Profondi", "deep-set eyes"],
      ["ravvicinati", "Ravvicinati", "close-set eyes"],
      ["distanziati", "Distanziati", "wide-set eyes"],
    ]),
  },
  {
    id: "occhi_colore", name: "Colore occhi",
    options: opts([
      ["marroni", "Marroni", "brown eyes"],
      ["nocciola", "Nocciola", "hazel eyes"],
      ["verdi", "Verdi", "green eyes"],
      ["azzurri", "Azzurri", "blue eyes"],
      ["grigi", "Grigi", "gray eyes"],
      ["neri", "Neri", "dark brown/black eyes"],
    ]),
  },
  {
    id: "sopracciglia", name: "Sopracciglia",
    options: opts([
      ["sottili", "Sottili", "thin eyebrows"],
      ["folte", "Folte", "thick eyebrows"],
      ["arcuate", "Arcuate", "arched eyebrows"],
      ["dritte", "Dritte", "straight eyebrows"],
    ]),
  },
  {
    id: "naso", name: "Naso",
    options: opts([
      ["piccolo", "Piccolo", "small nose"],
      ["dritto", "Dritto", "straight nose"],
      ["aquilino", "Aquilino", "aquiline nose"],
      ["all_insu", "All'insù", "upturned nose"],
      ["largo", "Largo", "wide nose"],
      ["sottile", "Sottile", "narrow nose"],
    ]),
  },
  {
    id: "labbra", name: "Labbra / bocca",
    options: opts([
      ["sottili", "Sottili", "thin lips"],
      ["carnose", "Carnose", "full lips"],
      ["a_cuore", "A cuore", "heart-shaped lips"],
      ["larghe", "Larghe", "wide mouth"],
      ["piccole", "Piccole", "small mouth"],
    ]),
  },
  {
    id: "mascella_mento", name: "Mascella / mento",
    options: opts([
      ["mascella_definita", "Mascella definita", "defined jawline"],
      ["mascella_morbida", "Mascella morbida", "soft jawline"],
      ["mascella_squadrata", "Mascella squadrata", "square jawline"],
      ["mento_pronunciato", "Mento pronunciato", "prominent chin"],
      ["mento_piccolo", "Mento piccolo", "small chin"],
      ["mento_a_fossetta", "Mento con fossetta", "chin with dimple"],
    ]),
  },
  {
    id: "zigomi", name: "Zigomi",
    options: opts([
      ["alti", "Alti", "high cheekbones"],
      ["marcati", "Marcati", "prominent cheekbones"],
      ["morbidi", "Morbidi", "soft cheekbones"],
    ]),
  },
  {
    id: "caratteristiche", name: "Caratteristiche particolari",
    options: opts([
      ["lentiggini_viso", "Lentiggini sul viso", "freckles on face"],
      ["nei", "Nei", "beauty marks"],
      ["fossette", "Fossette", "dimples"],
      ["barba_leggera", "Barba leggera", "light stubble"],
      ["barba_curata", "Barba curata", "well-groomed beard"],
      ["baffi", "Baffi", "mustache"],
      ["pelle_pulita", "Pelle pulita/liscia", "clear smooth skin"],
    ]),
  },
  {
    id: "espressione", name: "Espressione",
    options: opts([
      ["sorriso", "Sorriso", "smiling expression"],
      ["sorriso_ampio", "Sorriso ampio", "big smile, showing teeth"],
      ["seria", "Seria", "serious expression"],
      ["neutra", "Neutra", "neutral expression"],
      ["sensuale", "Sensuale", "sensual expression"],
      ["sorpresa", "Sorpresa", "surprised expression"],
      ["pensierosa", "Pensierosa", "thoughtful expression"],
      ["sicura", "Sicura di sé", "confident expression"],
    ]),
  },
];

/**
 * Path B — reference photo + Identity Lock.
 * Returns the ordered list of prompt fragments that must be added with HIGH
 * priority to preserve identity. This text intentionally repeats/insists,
 * because it needs to dominate the rest of the prompt for consistent
 * characters across generations.
 */
export function buildIdentityLockFragments() {
  return [
    "same person as reference image",
    "consistent facial identity",
    "preserve exact facial structure and face shape",
    "preserve exact eyes, nose, mouth and jawline from reference",
    "preserve original skin tone",
    "natural skin texture",
    "do not alter facial identity",
  ];
}
