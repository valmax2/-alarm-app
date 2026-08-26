// ==========================================================================
// data/cameraLight.js — STEP 7: CAMERA E LUCE library.
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

export const cameraCategories = [
  {
    id: "inquadratura", name: "Inquadratura",
    options: opts([
      ["close_up", "Close-up", "close-up shot"],
      ["headshot", "Headshot", "headshot"],
      ["head_shoulders", "Testa e spalle", "head and shoulders shot"],
      ["medium_shot", "Piano medio", "medium shot"],
      ["cowboy_shot", "Cowboy shot", "cowboy shot"],
      ["full_body", "Figura intera", "full body shot"],
      ["wide_shot", "Campo largo", "wide shot"],
      ["extreme_wide", "Campo lunghissimo", "extreme wide shot"],
    ]),
  },
  {
    id: "punto_vista", name: "Punto di vista",
    options: opts([
      ["frontale", "Frontale", "front view"],
      ["tre_quarti_sx", "3/4 sinistra", "three-quarter left view"],
      ["tre_quarti_dx", "3/4 destra", "three-quarter right view"],
      ["profilo", "Profilo", "side profile view"],
      ["posteriore", "Posteriore", "back view"],
      ["low_angle", "Low angle", "low angle shot"],
      ["high_angle", "High angle", "high angle shot"],
      ["top_down", "Top down", "top-down view"],
      ["dal_basso", "Dal basso", "shot from below"],
      ["dutch_angle", "Dutch angle", "dutch angle shot"],
    ]),
  },
  {
    id: "obiettivo", name: "Zoom / distanza / angolo",
    options: opts([
      ["zoom_in", "Zoom ravvicinato", "zoomed in"],
      ["zoom_out", "Zoom ampio", "zoomed out"],
      ["distanza_ravvicinata", "Distanza ravvicinata", "close distance"],
      ["distanza_media", "Distanza media", "medium distance"],
      ["distanza_ampia", "Distanza ampia", "far distance"],
      ["orbit", "Orbit / giro attorno", "orbiting camera angle"],
      ["tilt", "Tilt", "tilted camera"],
      ["sguardo_camera", "Sguardo verso la camera", "eye contact with camera"],
      ["sguardo_altrove", "Sguardo altrove", "looking away from camera"],
    ]),
  },
];

export const lightCategories = [
  {
    id: "illuminazione", name: "Illuminazione",
    options: opts([
      ["naturale", "Luce naturale", "natural light"],
      ["soft_studio", "Soft studio", "soft studio lighting"],
      ["studio_uniforme", "Studio uniforme", "even studio lighting"],
      ["cinematografica", "Cinematografica", "cinematic lighting"],
      ["rembrandt", "Rembrandt", "rembrandt lighting"],
      ["butterfly", "Butterfly", "butterfly lighting"],
      ["controluce", "Controluce", "backlighting"],
      ["side_lighting", "Side lighting", "side lighting"],
      ["golden_hour", "Golden hour", "golden hour lighting"],
      ["blue_hour", "Blue hour", "blue hour lighting"],
      ["neon", "Neon", "neon lighting"],
      ["volumetrica", "Volumetrica", "volumetric lighting"],
      ["drammatica", "Drammatica", "dramatic lighting"],
      ["notturna", "Notturna", "night time lighting"],
      ["morbida_diffusa", "Morbida e diffusa", "soft diffused lighting"],
      ["dura_contrastata", "Dura e contrastata", "hard contrasty lighting"],
    ]),
  },
];
