// ==========================================================================
// data/clothing.js — STEP 2 (Corpo): dedicated "Abbigliamento / Nudità"
// section — specify whether the character is nude, in underwear/lingerie,
// covered by something, or dressed. All button-driven like every other
// category (Italian label above, English prompt fragment below).
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

const livello = opts([
  ["nuda", "Nuda/o completamente", "completely nude"],
  ["topless", "Topless", "topless"],
  ["solo_intimo", "Solo intimo", "wearing only underwear"],
  ["seminuda", "Semi-vestita/o", "partially dressed, some clothing removed"],
  ["in_costume", "In costume da bagno", "wearing a swimsuit"],
  ["vestita", "Vestita/o (abiti normali)", "fully clothed, casual outfit"],
  ["elegante_vestita", "Vestita/o elegante", "fully clothed, elegant outfit"],
  ["nudo_artistico", "Nudo artistico (coperture parziali)", "artistic nude, implied nudity with tasteful partial covering"],
]);

const intimo = opts([
  ["reggiseno_pizzo", "Reggiseno di pizzo", "lace bra"],
  ["slip_pizzo", "Slip di pizzo", "lace panties"],
  ["completo_intimo_pizzo", "Completo intimo di pizzo", "matching lace lingerie set"],
  ["perizoma", "Perizoma", "thong"],
  ["body_intimo", "Body intimo", "lingerie bodysuit"],
  ["reggicalze", "Reggicalze e calze", "garter belt and stockings"],
  ["reggiseno_sportivo", "Reggiseno sportivo", "sports bra"],
  ["slip_cotone", "Slip di cotone semplice", "simple cotton panties"],
  ["senza_reggiseno", "Senza reggiseno", "braless"],
  ["senza_slip", "Senza slip", "no panties"],
  ["boxer", "Boxer", "boxer shorts"],
  ["intimo_trasparente", "Intimo trasparente", "sheer see-through lingerie"],
]);

const coprente = opts([
  ["lenzuolo", "Lenzuolo che copre parzialmente", "bedsheet partially covering the body"],
  ["accappatoio_aperto", "Accappatoio aperto", "open bathrobe"],
  ["vestaglia_trasparente", "Vestaglia trasparente", "sheer see-through robe"],
  ["asciugamano", "Asciugamano avvolto", "wrapped in a towel"],
  ["camicia_maschile", "Solo con una camicia da uomo", "wearing only an oversized men's shirt"],
  ["giacca_sulle_spalle", "Giacca appoggiata sulle spalle", "jacket draped over shoulders, nothing underneath"],
  ["mani_a_coprire", "Mani/braccia a coprire il corpo", "hands and arms strategically covering the body"],
  ["nessuna_copertura", "Nessuna copertura", "no covering at all"],
]);

export const clothingCategories = [
  { id: "abbigliamento_livello", name: "Livello di nudità / abbigliamento", options: livello },
  { id: "abbigliamento_intimo", name: "Intimo / lingerie", options: intimo },
  { id: "abbigliamento_coprente", name: "Coperture / props", options: coprente },
];
