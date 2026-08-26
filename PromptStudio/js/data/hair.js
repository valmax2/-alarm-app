// ==========================================================================
// data/hair.js — STEP 4: CAPELLI library.
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

export const hairCategories = [
  {
    id: "acconciatura", name: "Acconciatura",
    options: opts([
      ["corti", "Capelli corti", "short hair"],
      ["medi", "Capelli medi", "medium length hair"],
      ["lunghi", "Capelli lunghi", "long hair"],
      ["molto_lunghi", "Molto lunghi", "very long hair"],
      ["bob", "Bob", "bob haircut"],
      ["bob_mento", "Bob al mento", "chin-length bob"],
      ["bob_asimmetrico", "Bob asimmetrico", "asymmetrical bob"],
      ["pixie", "Pixie", "pixie cut"],
      ["coda_alta", "Coda alta", "high ponytail"],
      ["coda_bassa", "Coda bassa", "low ponytail"],
      ["chignon", "Chignon", "hair in a bun"],
      ["treccia", "Treccia singola", "single braid"],
      ["doppie_trecce", "Doppie trecce", "double braids, pigtails"],
      ["boxer_braids", "Boxer braids", "boxer braids, cornrows"],
      ["rasati_lato", "Rasati lateralmente", "undercut, shaved sides"],
      ["mezzo_raccolto", "Mezzo raccolto", "half-up half-down hairstyle"],
      ["sciolti", "Sciolti", "loose flowing hair"],
    ]),
  },
  {
    id: "texture", name: "Texture",
    options: opts([
      ["lisci", "Lisci", "straight hair"],
      ["mossi", "Mossi", "wavy hair"],
      ["ricci", "Ricci", "curly hair"],
      ["afro", "Afro", "afro-textured hair"],
      ["ondulati", "Ondulati", "loosely wavy hair"],
    ]),
  },
  {
    id: "colore_capelli", name: "Colore",
    options: opts([
      ["nero", "Nero", "black hair"],
      ["castano", "Castano", "brown hair"],
      ["castano_chiaro", "Castano chiaro", "light brown hair"],
      ["biondo", "Biondo", "blonde hair"],
      ["biondo_platino", "Biondo platino", "platinum blonde hair"],
      ["rosso", "Rosso", "red hair"],
      ["ramato", "Ramato", "auburn hair"],
      ["grigio_argento", "Grigio/argento", "silver gray hair"],
      ["colorato", "Colorato/fantasia", "vividly colored hair"],
      ["mechato", "Con mèches/balayage", "highlighted balayage hair"],
    ]),
  },
  {
    id: "volume", name: "Volume",
    options: opts([
      ["sottili", "Sottili/piatti", "flat thin hair"],
      ["normali", "Normali", "normal volume hair"],
      ["voluminosi", "Voluminosi", "voluminous hair"],
      ["molto_voluminosi", "Molto voluminosi", "very voluminous, thick hair"],
    ]),
  },
  {
    id: "frangia_riga", name: "Frangia / riga",
    options: opts([
      ["senza_frangia", "Senza frangia", "no bangs"],
      ["frangia_dritta", "Frangia dritta", "straight-cut bangs"],
      ["frangia_laterale", "Frangia laterale", "side-swept bangs"],
      ["frangia_corta", "Frangia corta", "short bangs"],
      ["riga_centrale", "Riga centrale", "center part"],
      ["riga_laterale", "Riga laterale", "side part"],
    ]),
  },
];

export function buildKeepReferenceHairFragment() {
  return ["same hairstyle as reference image", "preserve original hair color and texture"];
}
