// ==========================================================================
// data/body.js — STEP 2: CORPO library.
// Categories differ slightly by persona (donna adds Seno/Sedere, uomo adds
// Petto/Addominali) but most of the library is shared.
// Each option: { id, label (IT, shown to user), frag (EN, goes in the prompt) }
//
// Every category here is a SINGLE trait (one measurement/shape/tone), so the
// wizard treats it as exclusive (pick one, like a radio button) — see the
// EXCLUSIVE_BODY_CATEGORY_IDS set below. Where a real-world trait actually
// mixes more than one independent aspect (e.g. "torso" = shoulder width +
// torso shape, "seno" = size + firmness + shape + spacing), it's split into
// separate single-trait categories instead of one mixed list, so picking a
// new value for one aspect can no longer leave an old, contradictory value
// from a different aspect still selected (e.g. "slim body" AND "curvy body"
// both active at once, which silently diluted/confused the final prompt).
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

const spalle = opts([
  ["spalle_strette", "Spalle strette", "narrow shoulders"],
  ["spalle_medie", "Spalle medie", "average shoulders"],
  ["spalle_larghe", "Spalle larghe", "broad shoulders"],
]);

const formaTorso = opts([
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

const gambeLunghezza = opts([
  ["corte", "Corte", "short legs"],
  ["proporzionate", "Proporzionate", "proportionate legs"],
  ["lunghe", "Lunghe", "long legs"],
  ["molto_lunghe", "Molto lunghe", "very long legs"],
]);

const gambeTono = opts([
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

const pelleTono = opts([
  ["chiara", "Chiara", "fair skin"],
  ["porcellana", "Porcellana", "porcelain skin"],
  ["olivastra", "Olivastra", "olive skin"],
  ["abbronzata", "Abbronzata", "tanned skin"],
  ["scura", "Scura", "dark skin"],
  ["ebano", "Ebano", "ebony skin"],
]);

const pelleTexture = opts([
  ["lentiggini", "Con lentiggini", "freckled skin"],
  ["texture_naturale", "Texture naturale", "natural skin texture, visible pores"],
]);

const senoDimensione = opts([
  ["piccolo", "Piccolo", "small breasts"],
  ["medio", "Medio", "medium breasts"],
  ["grande", "Grande", "large breasts"],
  ["molto_grande", "Molto grande", "very large breasts"],
  ["abbondante", "Abbondante", "full breasts"],
  ["piatto", "Piatto", "flat chest"],
]);

const senoSodezza = opts([
  ["sodo", "Sodo", "firm breasts"],
  ["naturale", "Naturale", "natural breasts"],
  ["cadente", "Cadente", "saggy droopy breasts"],
  ["rivolto_alto", "Rivolto verso l'alto", "upward-pointing perky breasts"],
]);

const senoForma = opts([
  ["a_coppa_champagne", "A coppa di champagne", "champagne coupe shaped breasts"],
  ["a_goccia", "A goccia", "teardrop shaped breasts"],
  ["rotondo", "Rotondo", "round breasts"],
  ["a_campana", "A campana", "bell-shaped breasts"],
  ["atletico", "Atletico", "athletic breasts"],
  ["asimmetrico", "Asimmetrico", "asymmetrical breasts"],
]);

const senoPosizione = opts([
  ["distanziato", "Distanziato", "wide-set breasts"],
  ["ravvicinato", "Ravvicinato", "close-set breasts"],
]);

const sedereDimensione = opts([
  ["piccolo", "Piccolo", "small butt"],
  ["medio", "Medio", "medium butt"],
  ["grande", "Grande", "large butt"],
]);

const sedereForma = opts([
  ["rotondo", "Rotondo", "round butt"],
  ["sodo", "Sodo", "firm butt"],
  ["prosperoso", "Prosperoso", "curvy full butt"],
]);

const pettoGenerale = opts([
  ["muscoloso", "Muscoloso", "muscular chest"],
  ["definito", "Definito", "well-defined chest"],
  ["atletico", "Atletico", "athletic chest"],
  ["addominali_scolpiti", "Addominali scolpiti", "sculpted abs, six-pack"],
]);

const pettoPelo = opts([
  ["leggero_pelo", "Con leggero pelo", "light chest hair"],
  ["glabro", "Glabro", "smooth hairless chest"],
]);

// Categories where only ONE option makes sense at a time (a body can't be
// both "short" and "very tall"). The wizard toggles these with
// {exclusive:true} — see promptBuilder.js's renderCorpo.
export const EXCLUSIVE_BODY_CATEGORY_IDS = new Set([
  "corporatura", "altezza", "spalle", "forma_torso", "vita", "fianchi",
  "gambe_lunghezza", "gambe_tono", "braccia", "pelle_tono",
  "seno_dimensione", "seno_sodezza", "seno_forma", "seno_posizione",
  "sedere_dimensione", "sedere_forma", "petto_generale", "petto_pelo",
]);

/** Returns the ordered list of body categories for the chosen persona. */
export function getBodyCategories(persona) {
  const common = [
    { id: "corporatura", name: "Corporatura", options: corporatura },
    { id: "altezza", name: "Altezza", options: altezza },
    { id: "spalle", name: "Spalle", options: spalle },
    { id: "forma_torso", name: "Forma del torso", options: formaTorso },
    { id: "vita", name: "Vita", options: vita },
    { id: "fianchi", name: "Fianchi", options: fianchi },
    { id: "gambe_lunghezza", name: "Gambe — lunghezza", options: gambeLunghezza },
    { id: "gambe_tono", name: "Gambe — tono", options: gambeTono },
    { id: "braccia", name: "Braccia", options: braccia },
    { id: "pelle_tono", name: "Pelle — tono", options: pelleTono },
    { id: "pelle_texture", name: "Pelle — texture", options: pelleTexture },
  ];
  if (persona === "donna") {
    return [
      ...common.slice(0, 4),
      { id: "seno_dimensione", name: "Seno — dimensione", options: senoDimensione },
      { id: "seno_sodezza", name: "Seno — sodezza", options: senoSodezza },
      { id: "seno_forma", name: "Seno — forma", options: senoForma },
      { id: "seno_posizione", name: "Seno — posizione", options: senoPosizione },
      ...common.slice(4, 8),
      { id: "sedere_dimensione", name: "Sedere — dimensione", options: sedereDimensione },
      { id: "sedere_forma", name: "Sedere — forma", options: sedereForma },
      ...common.slice(8),
    ];
  }
  // uomo (and fallback)
  return [
    ...common.slice(0, 4),
    { id: "petto_generale", name: "Petto / Addominali", options: pettoGenerale },
    { id: "petto_pelo", name: "Petto — peli", options: pettoPelo },
    ...common.slice(4),
  ];
}
