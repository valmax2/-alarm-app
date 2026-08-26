// ==========================================================================
// data/actionsPoses.js — STEP 5: AZIONE E POSA (kept as two separate
// libraries per spec).
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

export const actionCategories = [
  {
    id: "azione", name: "Azione",
    options: opts([
      ["in_piedi", "In piedi", "standing"],
      ["cammina", "Cammina", "walking"],
      ["corre", "Corre", "running"],
      ["salta", "Salta", "jumping"],
      ["si_siede", "Si siede", "sitting down"],
      ["si_sdraia", "Si sdraia", "lying down"],
      ["guarda_camera", "Guarda la camera", "looking at camera"],
      ["guarda_lato", "Guarda lateralmente", "looking to the side"],
      ["si_gira", "Si gira", "turning around"],
      ["si_piega", "Si piega", "bending over"],
      ["balla", "Balla", "dancing"],
      ["parla", "Parla", "talking"],
      ["ride", "Ride", "laughing"],
      ["sorride", "Sorride", "smiling"],
      ["si_allena", "Si allena", "working out"],
      ["cammina_verso", "Cammina verso la camera", "walking towards camera"],
      ["appoggiata", "Appoggiata a un muro", "leaning against a wall"],
      ["beve", "Beve", "drinking"],
      ["legge", "Legge", "reading"],
    ]),
  },
];

export const poseCategories = [
  {
    id: "posa_orientamento", name: "Posa — orientamento",
    options: opts([
      ["frontale", "Frontale", "frontal pose"],
      ["tre_quarti", "3/4", "three-quarter pose"],
      ["profilo", "Profilo", "profile pose"],
      ["vista_posteriore", "Vista posteriore", "back view pose"],
      ["guardando_indietro", "Guarda indietro verso la camera", "looking back over shoulder at camera"],
    ]),
  },
  {
    id: "posa_in_piedi", name: "Posa — in piedi",
    options: opts([
      ["contrapposto", "Contrapposto", "contrapposto pose"],
      ["braccia_incrociate", "Braccia incrociate", "arms crossed"],
      ["mani_fianchi", "Mani sui fianchi", "hands on hips"],
      ["mani_capelli", "Mani tra i capelli", "hands in hair"],
      ["mani_dietro_schiena", "Mani dietro la schiena", "hands behind back"],
      ["una_gamba_avanti", "Una gamba in avanti", "one leg forward"],
      ["appoggiata_muro", "Appoggiata/o a un muro", "leaning against a wall"],
      ["braccia_alzate", "Braccia alzate", "arms raised up"],
      ["si_stiracchia", "Si stiracchia", "stretching pose"],
      ["mani_incrociate_davanti", "Mani incrociate davanti", "hands clasped in front"],
      ["mano_su_capello", "Mano tra i capelli mossa dal vento", "hand running through windblown hair"],
    ]),
  },
  {
    id: "posa_seduta_sdraiata", name: "Posa — seduta / sdraiata",
    options: opts([
      ["seduto", "Seduto/a", "sitting pose"],
      ["seduto_gambe_incrociate", "Seduto/a a gambe incrociate", "sitting cross-legged"],
      ["seduto_terra", "Seduto/a per terra", "sitting on the floor"],
      ["seduto_bordo", "Seduto/a sul bordo", "sitting on the edge"],
      ["accovacciato", "Accovacciato/a", "crouching pose"],
      ["ginocchia", "In ginocchio", "kneeling pose"],
      ["ginocchio_singolo", "In ginocchio su una gamba", "kneeling on one knee"],
      ["sdraiato_schiena", "Sdraiato/a sulla schiena", "lying on back"],
      ["sdraiato_pancia", "Sdraiato/a sulla pancia", "lying on stomach"],
      ["sdraiato_fianco", "Sdraiato/a su un fianco", "lying on side"],
      ["appoggiato_gomiti", "Appoggiato/a sui gomiti", "propped up on elbows"],
      ["reclinato", "Reclinato/a", "reclining pose"],
    ]),
  },
  {
    id: "posa_dinamica", name: "Posa — dinamica",
    options: opts([
      ["dinamica", "Dinamica/action pose", "dynamic action pose"],
      ["salto_a_mezz_aria", "Salto a mezz'aria", "mid-air jumping pose"],
      ["in_corsa", "In corsa", "running pose"],
      ["in_torsione", "In torsione/si gira", "twisting turning pose"],
      ["capelli_al_vento", "Capelli in movimento", "hair flip motion pose"],
      ["danza", "In danza", "dancing pose"],
      ["equilibrio", "In equilibrio su un piede", "balancing on one foot"],
    ]),
  },
  {
    id: "posa_espressiva", name: "Posa — espressiva / artistica",
    options: opts([
      ["rilassata", "Rilassata", "relaxed pose"],
      ["elegante", "Elegante", "elegant pose"],
      ["schiena_arcuata", "Schiena arcuata", "arched back pose"],
      ["mani_sopra_testa", "Mani sopra la testa", "hands above head"],
      ["sguardo_di_spalle", "Di spalle, sguardo verso la camera", "back to camera, looking over shoulder"],
      ["posa_potente", "Posa potente/sicura", "powerful confident pose"],
      ["posa_timida", "Posa timida/riservata", "shy reserved pose"],
      ["silhouette", "A silhouette", "silhouette pose"],
      ["seduttiva", "Seduttiva", "seductive pose"],
    ]),
  },
];
