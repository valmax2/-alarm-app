# Anteprime fotorealistiche incorporate

Metti qui un file `<id-voce>.jpg` per collegare un'anteprima fotorealistica reale a una voce
del catalogo di serie (vedi `StyleCatalogSeed.kt` per gli id, es. `seed-capelli-01.jpg`,
`seed-barba-03.jpg`, `seed-trucco-12.jpg`). Al primo avvio l'app copia automaticamente ogni
file trovato qui nello storage interno e lo usa come anteprima al posto di quella procedurale
(vedi `StyleCatalogRepository.copiaAnteprimaIncorporataSeNecessario`). Nessuna modifica al
codice e' necessaria: basta aggiungere il file con il nome giusto.

Le immagini si possono generare in batch con `tools/generate_style_previews.py`.
