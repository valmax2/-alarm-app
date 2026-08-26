// ==========================================================================
// data/scenes.js — STEP 6: SCENA / AMBIENTE library.
// ==========================================================================

function opts(list) {
  return list.map(([id, label, frag]) => ({ id, label, frag }));
}

export const sceneCategories = [
  {
    id: "ambiente", name: "Ambiente",
    options: opts([
      ["studio_foto", "Studio fotografico", "photography studio"],
      ["casa", "Casa", "home interior"],
      ["salotto", "Salotto", "living room"],
      ["camera", "Camera da letto", "bedroom"],
      ["cucina", "Cucina", "kitchen"],
      ["bagno", "Bagno", "bathroom"],
      ["ufficio", "Ufficio", "office"],
      ["ristorante", "Ristorante", "restaurant"],
      ["bar", "Bar", "bar"],
      ["strada", "Strada", "street"],
      ["citta", "Città", "city"],
      ["citta_futuristica", "Città futuristica", "futuristic city"],
      ["spiaggia", "Spiaggia", "beach"],
      ["mare", "Mare", "sea"],
      ["piscina", "Piscina", "swimming pool"],
      ["montagna", "Montagna", "mountains"],
      ["bosco", "Bosco", "forest"],
      ["parco", "Parco", "park"],
      ["palestra", "Palestra", "gym"],
      ["terrazza", "Terrazza", "rooftop terrace"],
      ["auto", "Auto", "inside a car"],
      ["locale_notturno", "Locale notturno", "nightclub"],
      ["fantasy", "Ambientazione fantasy", "fantasy setting"],
      ["sci_fi", "Ambientazione sci-fi", "sci-fi setting"],
    ]),
  },
  {
    id: "interno_esterno", name: "Interno / esterno",
    options: opts([
      ["interno", "Interno", "indoor"],
      ["esterno", "Esterno", "outdoor"],
    ]),
  },
  {
    id: "momento", name: "Giorno / notte",
    options: opts([
      ["giorno", "Giorno", "daytime"],
      ["alba", "Alba", "sunrise"],
      ["tramonto", "Tramonto", "sunset"],
      ["notte", "Notte", "night time"],
    ]),
  },
  {
    id: "meteo", name: "Meteo",
    options: opts([
      ["sereno", "Sereno", "clear sky"],
      ["nuvoloso", "Nuvoloso", "cloudy"],
      ["pioggia", "Pioggia", "rainy"],
      ["nebbia", "Nebbia", "foggy"],
      ["neve", "Neve", "snowy"],
      ["vento", "Vento", "windy"],
    ]),
  },
  {
    id: "stagione", name: "Stagione",
    options: opts([
      ["primavera", "Primavera", "spring season"],
      ["estate", "Estate", "summer season"],
      ["autunno", "Autunno", "autumn season"],
      ["inverno", "Inverno", "winter season"],
    ]),
  },
  {
    id: "atmosfera", name: "Atmosfera",
    options: opts([
      ["romantica", "Romantica", "romantic atmosphere"],
      ["misteriosa", "Misteriosa", "mysterious atmosphere"],
      ["allegra", "Allegra", "cheerful atmosphere"],
      ["drammatica", "Drammatica", "dramatic atmosphere"],
      ["rilassata", "Rilassata", "relaxed atmosphere"],
      ["elegante", "Elegante", "elegant atmosphere"],
      ["futuristica", "Futuristica", "futuristic atmosphere"],
      ["vintage", "Vintage", "vintage atmosphere"],
    ]),
  },
];
