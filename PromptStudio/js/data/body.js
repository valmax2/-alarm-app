// ==========================================================================
// data/body.js — STEP 2: CORPO library.
// Categories differ slightly by persona (donna adds Seno/Sedere, uomo adds
// Petto/Addominali) but most of the library is shared.
// Each option: { id, label (IT, shown to user), frag (EN, goes in the prompt) }
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

const corporatura = opts([
  ["magra", "Magra", "slim body"],
  ["slanciata", "Slanciata", "slender body"],
  ["atletica", "Atletica", "athletic build"],
  ["sportiva", "Sportiva", "toned sporty build"],
  ["curvy", "Curvy", "curvy body"],
  ["formosa", "Formosa", "voluptuous body"],
  ["robusta", "Robusta", "sturdy build"],
  ["muscolosa", "Muscolosa", "muscular build"],
  ["esile", "Esile", "petite slight build"],
  ["media", "Media / normale", "average build"],
]);

const altezza = opts([
  ["bassa", "Bassa", "short height"],
  ["media", "Media", "average height"],
  ["alta", "Alta", "tall"],
  ["molto_alta", "Molto alta", "very tall"],
]);

const torso = opts([
  ["spalle_strette", "Spalle strette", "narrow shoulders"],
  ["spalle_medie", "Spalle medie", "average shoulders"],
  ["spalle_larghe", "Spalle larghe", "broad shoulders"],
  ["torso_v", "Torso a V", "V-shaped torso"],
  ["torso_clessidra", "Torso a clessidra", "hourglass torso"],
  ["petto_stretto", "Petto stretto", "narrow chest"],
  ["petto_largo", "Petto largo", "broad chest"],
]);

const vita = opts([
  ["stretta", "Stretta", "narrow waist"],
  ["sottile", "Sottile", "slim waist"],
  ["definita", "Definita", "well-defined waist"],
  ["media", "Media", "average waist"],
  ["larga", "Larga", "wide waist"],
]);

const fianchi = opts([
  ["stretti", "Stretti", "narrow hips"],
  ["medi", "Medi", "average hips"],
  ["larghi", "Larghi", "wide hips"],
  ["arrotondati", "Arrotondati", "rounded hips"],
  ["prosperosi", "Prosperosi", "curvy full hips"],
]);

const gambe = opts([
  ["corte", "Corte", "short legs"],
  ["proporzionate", "Proporzionate", "proportionate legs"],
  ["lunghe", "Lunghe", "long legs"],
  ["molto_lunghe", "Molto lunghe", "very long legs"],
  ["slanciate", "Slanciate", "slender legs"],
  ["muscolose", "Muscolose", "muscular legs"],
  ["tornite", "Tornite", "shapely legs"],
  ["snelle", "Snelle", "lean legs"],
]);

const braccia = opts([
  ["toniche", "Toniche", "toned arms"],
  ["muscolose", "Muscolose", "muscular arms"],
  ["magre", "Magre", "slender arms"],
  ["definite", "Definite", "well-defined arms"],
]);

const pelle = opts([
  ["chiara", "Chiara", "fair skin"],
  ["porcellana", "Porcellana", "porcelain skin"],
  ["olivastra", "Olivastra", "olive skin"],
  ["abbronzata", "Abbronzata", "tanned skin"],
  ["scura", "Scura", "dark skin"],
  ["ebano", "Ebano", "ebony skin"],
  ["lentiggini", "Con lentiggini", "freckled skin"],
  ["texture_naturale", "Texture naturale", "natural skin texture, visible pores"],
]);

const seno = opts([
  // dimensione
  ["piccolo", "Piccolo", "small breasts"],
  ["medio", "Medio", "medium breasts"],
  ["grande", "Grande", "large breasts"],
  ["molto_grande", "Molto grande", "very large breasts"],
  ["abbondante", "Abbondante", "full breasts"],
  ["piatto", "Piatto", "flat chest"],
  // sodezza / assetto
  ["sodo", "Sodo", "firm breasts"],
  ["naturale", "Naturale", "natural breasts"],
  ["cadente", "Cadente", "saggy droopy breasts"],
  ["rivolto_alto", "Rivolto verso l'alto", "upward-pointing perky breasts"],
  // forma
  ["a_coppa_champagne", "A coppa di champagne", "champagne coupe shaped breasts"],
  ["a_goccia", "A goccia", "teardrop shaped breasts"],
  ["rotondo", "Rotondo", "round breasts"],
  ["a_campana", "A campana", "bell-shaped breasts"],
  ["atletico", "Atletico", "athletic breasts"],
  ["asimmetrico", "Asimmetrico", "asymmetrical breasts"],
  // posizione
  ["distanziato", "Distanziato", "wide-set breasts"],
  ["ravvicinato", "Ravvicinato", "close-set breasts"],
]);

const sedere = opts([
  ["piccolo", "Piccolo", "small butt"],
  ["medio", "Medio", "medium butt"],
  ["grande", "Grande", "large butt"],
  ["rotondo", "Rotondo", "round butt"],
  ["sodo", "Sodo", "firm butt"],
  ["prosperoso", "Prosperoso", "curvy full butt"],
]);

const pettoAddominali = opts([
  ["muscoloso", "Muscoloso", "muscular chest"],
  ["definito", "Definito", "well-defined chest"],
  ["atletico", "Atletico", "athletic chest"],
  ["addominali_scolpiti", "Addominali scolpiti", "sculpted abs, six-pack"],
  ["leggero_pelo", "Con leggero pelo", "light chest hair"],
  ["glabro", "Glabro", "smooth hairless chest"],
]);

/** Returns the ordered list of body categories for the chosen persona. */
export function getBodyCategories(persona) {
  const common = [
    { id: "corporatura", name: "Corporatura", options: corporatura },
    { id: "altezza", name: "Altezza", options: altezza },
    { id: "torso", name: "Torso", options: torso },
    { id: "vita", name: "Vita", options: vita },
    { id: "fianchi", name: "Fianchi", options: fianchi },
    { id: "gambe", name: "Gambe", options: gambe },
    { id: "braccia", name: "Braccia", options: braccia },
    { id: "pelle", name: "Pelle", options: pelle },
  ];
  if (persona === "donna") {
    return [
      ...common.slice(0, 3),
      { id: "seno", name: "Seno", options: seno },
      ...common.slice(3, 6),
      { id: "sedere", name: "Sedere", options: sedere },
      ...common.slice(6),
    ];
  }
  // uomo (and fallback)
  return [
    ...common.slice(0, 3),
    { id: "petto_addominali", name: "Petto / Addominali", options: pettoAddominali },
    ...common.slice(3),
  ];
}
