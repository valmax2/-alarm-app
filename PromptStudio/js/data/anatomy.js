// ==========================================================================
// data/anatomy.js — glossario anatomico completo, aggiunto dentro lo STEP 2
// (Corpo) come sottocategorie extra. Ogni termine è un pulsante selezionabile
// come tutti gli altri (italiano sopra, inglese sotto); ogni sottocategoria
// mantiene comunque il tassello "➕ Aggiungi" per estenderla a mano.
// Diviso per zona del corpo per evitare un'unica lista interminabile.
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

const testaVolto = opts([
  ["testa", "Testa", "head"],
  ["capelli", "Capelli", "hair"],
  ["cuoio_capelluto", "Cuoio capelluto", "scalp"],
  ["fronte", "Fronte", "forehead"],
  ["sopracciglio", "Sopracciglio", "eyebrow"],
  ["occhio", "Occhio", "eye"],
  ["palpebra", "Palpebra", "eyelid"],
  ["ciglia", "Ciglia", "eyelashes"],
  ["naso", "Naso", "nose"],
  ["guancia", "Guancia", "cheek"],
  ["zigomo", "Zigomo", "cheekbone"],
  ["orecchio", "Orecchio", "ear"],
  ["lobo_orecchio", "Lobo dell'orecchio", "earlobe"],
  ["bocca", "Bocca", "mouth"],
  ["labbra", "Labbra", "lips"],
  ["lingua", "Lingua", "tongue"],
  ["denti", "Denti", "teeth"],
  ["gengiva", "Gengiva", "gum"],
  ["mento", "Mento", "chin"],
  ["mascella", "Mascella", "jaw"],
  ["doppio_mento", "Doppio mento", "double chin"],
]);

const colloSpalle = opts([
  ["collo", "Collo", "neck"],
  ["nuca", "Nuca", "nape"],
  ["gola", "Gola", "throat"],
  ["pomo_adamo", "Pomo d'Adamo", "adam's apple"],
  ["spalla", "Spalla", "shoulder"],
  ["clavicola", "Clavicola", "collarbone"],
]);

const toraceSeno = opts([
  ["torace", "Torace", "chest"],
  ["petto", "Petto", "chest"],
  ["seno", "Seno", "breasts"],
  ["capezzolo", "Capezzolo", "nipple"],
  ["areola", "Areola", "areola"],
  ["areola_grande", "Areola grande", "large areola"],
  ["areola_piccola", "Areola piccola", "small areola"],
  ["scollatura", "Scollatura", "cleavage"],
]);

const addomeSchiena = opts([
  ["addome", "Addome", "abdomen"],
  ["pancia", "Pancia", "belly"],
  ["ombelico", "Ombelico", "belly button"],
  ["fianco", "Fianco", "hip"],
  ["vita", "Vita", "waist"],
  ["schiena", "Schiena", "back"],
  ["colonna_vertebrale", "Colonna vertebrale", "spine"],
  ["scapola", "Scapola", "shoulder blade"],
  ["zona_lombare", "Zona lombare", "lower back"],
  ["fossette_venere", "Fossette di Venere", "dimples of Venus"],
]);

const bracciaMani = opts([
  ["braccio", "Braccio", "arm"],
  ["ascella", "Ascella", "armpit"],
  ["peli_ascellari", "Peli ascellari", "armpit hair"],
  ["gomito", "Gomito", "elbow"],
  ["avambraccio", "Avambraccio", "forearm"],
  ["polso", "Polso", "wrist"],
  ["mano", "Mano", "hand"],
  ["palmo", "Palmo", "palm"],
  ["nocche", "Nocche", "knuckles"],
  ["dito", "Dito", "finger"],
  ["pollice", "Pollice", "thumb"],
  ["indice", "Indice", "index finger"],
  ["medio", "Medio", "middle finger"],
  ["anulare", "Anulare", "ring finger"],
  ["mignolo", "Mignolo", "pinky"],
  ["unghia", "Unghia", "nail"],
]);

const bacinoGlutei = opts([
  ["sedere", "Sedere", "butt"],
  ["glutei", "Glutei", "buttocks"],
  ["natiche", "Natiche", "butt cheeks"],
  ["fessura_interglutea", "Fessura interglutea", "butt crack"],
  ["bacino", "Bacino", "pelvis"],
  ["inguine", "Inguine", "groin"],
]);

const genitali = opts([
  ["genitali", "Genitali", "genitals"],
  ["pene", "Pene", "penis"],
  ["asta_pene", "Asta del pene", "shaft of the penis"],
  ["glande", "Glande", "glans"],
  ["prepuzio", "Prepuzio", "foreskin"],
  ["testicoli", "Testicoli", "testicles"],
  ["scroto", "Scroto", "scrotum"],
  ["peli_pubici_maschili", "Peli pubici (maschili)", "male pubic hair"],
  ["vulva", "Vulva", "vulva"],
  ["grandi_labbra", "Grandi labbra", "labia majora"],
  ["piccole_labbra", "Piccole labbra", "labia minora"],
  ["clitoride", "Clitoride", "clitoris"],
  ["cappuccio_clitoride", "Cappuccio del clitoride", "clitoral hood"],
  ["vagina", "Vagina", "vagina"],
  ["monte_venere", "Monte di Venere", "mons pubis"],
  ["peli_pubici_femminili", "Peli pubici (femminili)", "female pubic hair"],
]);

const gambePiedi = opts([
  ["gamba", "Gamba", "leg"],
  ["coscia", "Coscia", "thigh"],
  ["interno_coscia", "Interno coscia", "inner thigh"],
  ["ginocchio", "Ginocchio", "knee"],
  ["rotula", "Rotula", "kneecap"],
  ["polpaccio", "Polpaccio", "calf"],
  ["stinco", "Stinco", "shin"],
  ["caviglia", "Caviglia", "ankle"],
  ["piede", "Piede", "foot"],
  ["tallone", "Tallone", "heel"],
  ["pianta_piede", "Pianta del piede", "sole of the foot"],
  ["collo_piede", "Collo del piede", "instep"],
  ["dito_piede", "Dito del piede", "toe"],
  ["alluce", "Alluce", "big toe"],
  ["unghia_piede", "Unghia del piede", "toenail"],
]);

const pellePeli = opts([
  ["pelle", "Pelle", "skin"],
  ["pelle_chiara", "Pelle chiara", "fair skin"],
  ["pelle_scura", "Pelle scura", "dark skin"],
  ["pelle_olivastra", "Pelle olivastra", "olive skin"],
  ["pelle_abbronzata", "Pelle abbronzata", "tanned skin"],
  ["peluria", "Peluria", "peach fuzz"],
  ["peli", "Peli", "body hair"],
  ["barba", "Barba", "beard"],
  ["baffi", "Baffi", "mustache"],
  ["landing_strip", "Pelo a striscia", "landing strip"],
  ["pelo_folto_pubico", "Pelo folto (pubico)", "bushy pubic hair"],
  ["depilazione_totale", "Depilazione totale", "clean shaven"],
]);

export const anatomyCategories = [
  { id: "anatomia_testa_volto", name: "Anatomia — Testa e volto", options: testaVolto },
  { id: "anatomia_collo_spalle", name: "Anatomia — Collo e spalle", options: colloSpalle },
  { id: "anatomia_torace_seno", name: "Anatomia — Torace e seno", options: toraceSeno },
  { id: "anatomia_addome_schiena", name: "Anatomia — Addome e schiena", options: addomeSchiena },
  { id: "anatomia_braccia_mani", name: "Anatomia — Braccia e mani", options: bracciaMani },
  { id: "anatomia_bacino_glutei", name: "Anatomia — Bacino e glutei", options: bacinoGlutei },
  { id: "anatomia_genitali", name: "Anatomia — Genitali", options: genitali },
  { id: "anatomia_gambe_piedi", name: "Anatomia — Gambe e piedi", options: gambePiedi },
  { id: "anatomia_pelle_peli", name: "Anatomia — Pelle e peli", options: pellePeli },
];
