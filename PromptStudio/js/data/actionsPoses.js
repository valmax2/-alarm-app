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
    id: "posa", name: "Posa",
    options: opts([
      ["frontale", "Frontale", "frontal pose"],
      ["tre_quarti", "3/4", "three-quarter pose"],
      ["profilo", "Profilo", "profile pose"],
      ["vista_posteriore", "Vista posteriore", "back view pose"],
      ["seduto", "Seduto/a", "sitting pose"],
      ["accovacciato", "Accovacciato/a", "crouching pose"],
      ["braccia_incrociate", "Braccia incrociate", "arms crossed"],
      ["mani_fianchi", "Mani sui fianchi", "hands on hips"],
      ["mani_capelli", "Mani tra i capelli", "hands in hair"],
      ["ginocchia", "In ginocchio", "kneeling pose"],
      ["dinamica", "Dinamica/action pose", "dynamic action pose"],
      ["rilassata", "Rilassata", "relaxed pose"],
      ["elegante", "Elegante", "elegant pose"],
    ]),
  },
];
