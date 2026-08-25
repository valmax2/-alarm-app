package it.vstudioapps.stylestudio3d.domain.model

/**
 * Catalogo "di serie": decine di stili reali (terminologia da hairstyling/barbering/makeup),
 * non due o tre placeholder. E' comunque solo il punto di partenza — dalla schermata "Crea
 * nuovo stile" l'utente aggiunge qualunque altra voce voglia, in qualsiasi lingua, e la libreria
 * cresce senza limiti perche' viene salvata da [it.vstudioapps.stylestudio3d.data.StyleCatalogRepository].
 */
object StyleCatalogSeed {

    private fun hair(
        id: String,
        name: String,
        length: StyleLength,
        volume: StyleVolume,
        texture: StyleTexture,
        audience: TargetAudience,
        colorHex: String,
        vararg tags: String,
    ) = StyleCatalogEntry(
        id = "seed-capelli-$id",
        category = StyleCategory.CAPELLI,
        name = name,
        attributes = StyleAttributes(length, volume, texture, audience, colorHex, 0.6f, tags.toList()),
        isBuiltIn = true,
    )

    private fun beard(
        id: String,
        name: String,
        length: StyleLength,
        volume: StyleVolume,
        audience: TargetAudience,
        colorHex: String,
        vararg tags: String,
    ) = StyleCatalogEntry(
        id = "seed-barba-$id",
        category = StyleCategory.BARBA,
        name = name,
        attributes = StyleAttributes(length, volume, StyleTexture.LISCIO, audience, colorHex, 0.6f, tags.toList()),
        isBuiltIn = true,
    )

    private fun makeup(
        id: String,
        name: String,
        intensity: Float,
        colorHex: String,
        vararg tags: String,
    ) = StyleCatalogEntry(
        id = "seed-trucco-$id",
        category = StyleCategory.TRUCCO,
        name = name,
        attributes = StyleAttributes(
            length = StyleLength.MEDIO,
            volume = StyleVolume.NATURALE,
            texture = StyleTexture.LISCIO,
            targetAudience = TargetAudience.UNISEX,
            colorHex = colorHex,
            intensity = intensity,
            tags = tags.toList(),
        ),
        isBuiltIn = true,
    )

    val hairstyles: List<StyleCatalogEntry> = listOf(
        hair("01", "Undercut sfumato", StyleLength.CORTO, StyleVolume.SCOLPITO, StyleTexture.LISCIO, TargetAudience.UNISEX, "#2B1B12", "undercut", "fade"),
        hair("02", "Pompadour classico", StyleLength.MEDIO, StyleVolume.VOLUMINOSO, StyleTexture.LISCIO, TargetAudience.MASCHILE, "#1C120B", "pompadour"),
        hair("03", "Buzz cut", StyleLength.RASATO, StyleVolume.PIATTO, StyleTexture.LISCIO, TargetAudience.UNISEX, "#2B1B12", "buzz cut"),
        hair("04", "Caschetto (bob) liscio", StyleLength.CORTO, StyleVolume.NATURALE, StyleTexture.LISCIO, TargetAudience.FEMMINILE, "#3B2A1F", "bob"),
        hair("05", "Long bob (lob) mosso", StyleLength.MEDIO, StyleVolume.NATURALE, StyleTexture.MOSSO, TargetAudience.FEMMINILE, "#4A2F1E", "lob"),
        hair("06", "Shag scalato", StyleLength.MEDIO, StyleVolume.VOLUMINOSO, StyleTexture.MOSSO, TargetAudience.UNISEX, "#5C3A22", "shag", "layers"),
        hair("07", "Trecce boxer", StyleLength.LUNGO, StyleVolume.SCOLPITO, StyleTexture.TRECCE, TargetAudience.UNISEX, "#1A1310", "box braids"),
        hair("08", "Treccia a spiga (fishtail)", StyleLength.LUNGO, StyleVolume.NATURALE, StyleTexture.TRECCE, TargetAudience.FEMMINILE, "#6B4226", "fishtail braid"),
        hair("09", "Afro naturale", StyleLength.MEDIO, StyleVolume.VOLUMINOSO, StyleTexture.AFRO, TargetAudience.UNISEX, "#1B1310", "afro"),
        hair("10", "Twist afro corti", StyleLength.CORTO, StyleVolume.VOLUMINOSO, StyleTexture.AFRO, TargetAudience.UNISEX, "#241713", "twists"),
        hair("11", "Coda alta liscia", StyleLength.LUNGO, StyleVolume.PIATTO, StyleTexture.LISCIO, TargetAudience.FEMMINILE, "#2E2015", "sleek ponytail"),
        hair("12", "Chignon basso", StyleLength.LUNGO, StyleVolume.SCOLPITO, StyleTexture.LISCIO, TargetAudience.FEMMINILE, "#2E2015", "chignon", "raccolto"),
        hair("13", "Ricci definiti extra long", StyleLength.EXTRA_LUNGO, StyleVolume.VOLUMINOSO, StyleTexture.RICCIO, TargetAudience.FEMMINILE, "#4A2F1E", "curly"),
        hair("14", "Beach waves", StyleLength.LUNGO, StyleVolume.NATURALE, StyleTexture.MOSSO, TargetAudience.UNISEX, "#8C6A3F", "beach waves"),
        hair("15", "Pixie cut corto", StyleLength.CORTISSIMO, StyleVolume.SCOLPITO, StyleTexture.LISCIO, TargetAudience.FEMMINILE, "#2E2015", "pixie cut"),
        hair("16", "Crew cut", StyleLength.CORTISSIMO, StyleVolume.NATURALE, StyleTexture.LISCIO, TargetAudience.MASCHILE, "#2B1B12", "crew cut"),
        hair("17", "Mullet moderno", StyleLength.MEDIO, StyleVolume.VOLUMINOSO, StyleTexture.MOSSO, TargetAudience.UNISEX, "#3B2A1F", "modern mullet"),
        hair("18", "Slick back", StyleLength.MEDIO, StyleVolume.PIATTO, StyleTexture.LISCIO, TargetAudience.MASCHILE, "#120C08", "slick back"),
        hair("19", "Curtain bangs con lunghezza", StyleLength.LUNGO, StyleVolume.NATURALE, StyleTexture.MOSSO, TargetAudience.UNISEX, "#5C3A22", "curtain bangs"),
        hair("20", "Frangia piena netta", StyleLength.MEDIO, StyleVolume.NATURALE, StyleTexture.LISCIO, TargetAudience.FEMMINILE, "#1B140F", "blunt bangs"),
        hair("21", "French crop", StyleLength.CORTO, StyleVolume.SCOLPITO, StyleTexture.LISCIO, TargetAudience.MASCHILE, "#2B1B12", "french crop"),
        hair("22", "Man bun", StyleLength.LUNGO, StyleVolume.SCOLPITO, StyleTexture.LISCIO, TargetAudience.MASCHILE, "#1B140F", "man bun"),
        hair("23", "Ricci corti afro-latini", StyleLength.CORTO, StyleVolume.VOLUMINOSO, StyleTexture.RICCIO, TargetAudience.MASCHILE, "#1B140F", "curly crop"),
        hair("24", "Wolf cut", StyleLength.MEDIO, StyleVolume.VOLUMINOSO, StyleTexture.MOSSO, TargetAudience.UNISEX, "#5C3A22", "wolf cut"),
        hair("25", "Coda bassa con ciocca liscia", StyleLength.LUNGO, StyleVolume.NATURALE, StyleTexture.LISCIO, TargetAudience.UNISEX, "#2E2015", "low ponytail"),
        hair("26", "Rasato ai lati, top lungo", StyleLength.LUNGO, StyleVolume.VOLUMINOSO, StyleTexture.MOSSO, TargetAudience.MASCHILE, "#2B1B12", "disconnected undercut"),
        hair("27", "Treccia olandese doppia", StyleLength.LUNGO, StyleVolume.NATURALE, StyleTexture.TRECCE, TargetAudience.FEMMINILE, "#6B4226", "dutch braids"),
        hair("28", "Capelli lisci extra lunghi", StyleLength.EXTRA_LUNGO, StyleVolume.PIATTO, StyleTexture.LISCIO, TargetAudience.FEMMINILE, "#0E0B09", "long sleek"),
        hair("29", "Taglio asimmetrico", StyleLength.CORTO, StyleVolume.SCOLPITO, StyleTexture.LISCIO, TargetAudience.UNISEX, "#3B2A1F", "asymmetric cut"),
        hair("30", "Onde old Hollywood", StyleLength.MEDIO, StyleVolume.SCOLPITO, StyleTexture.MOSSO, TargetAudience.FEMMINILE, "#1B140F", "finger waves"),
    )

    val beardsAndMustaches: List<StyleCatalogEntry> = listOf(
        beard("01", "Barba lunga folta", StyleLength.LUNGO, StyleVolume.VOLUMINOSO, TargetAudience.MASCHILE, "#2B1B12", "full beard"),
        beard("02", "Barba corta curata", StyleLength.CORTO, StyleVolume.SCOLPITO, TargetAudience.MASCHILE, "#2B1B12", "short boxed beard"),
        beard("03", "Ombra di barba (5 o'clock shadow)", StyleLength.RASATO, StyleVolume.PIATTO, TargetAudience.MASCHILE, "#2B1B12", "stubble"),
        beard("04", "Pizzetto (goatee)", StyleLength.CORTO, StyleVolume.SCOLPITO, TargetAudience.MASCHILE, "#2B1B12", "goatee"),
        beard("05", "Barba a catena (chin strap)", StyleLength.CORTISSIMO, StyleVolume.PIATTO, TargetAudience.MASCHILE, "#2B1B12", "chin strap"),
        beard("06", "Baffi a manubrio", StyleLength.CORTO, StyleVolume.SCOLPITO, TargetAudience.MASCHILE, "#2B1B12", "handlebar mustache"),
        beard("07", "Baffi a spazzola", StyleLength.CORTISSIMO, StyleVolume.NATURALE, TargetAudience.MASCHILE, "#2B1B12", "brush mustache"),
        beard("08", "Baffi sottili", StyleLength.CORTISSIMO, StyleVolume.PIATTO, TargetAudience.MASCHILE, "#2B1B12", "pencil mustache"),
        beard("09", "Barba hipster con baffi", StyleLength.MEDIO, StyleVolume.VOLUMINOSO, TargetAudience.MASCHILE, "#3B2A1F", "hipster beard"),
        beard("10", "Barba a forma di ancora", StyleLength.CORTO, StyleVolume.SCOLPITO, TargetAudience.MASCHILE, "#1B140F", "anchor beard"),
        beard("11", "Basette lunghe raccordate", StyleLength.MEDIO, StyleVolume.NATURALE, TargetAudience.MASCHILE, "#2B1B12", "mutton chops"),
        beard("12", "Barba fluviale (Balbo)", StyleLength.CORTO, StyleVolume.SCOLPITO, TargetAudience.MASCHILE, "#1B140F", "balbo beard"),
        beard("13", "Barba grigio naturale", StyleLength.MEDIO, StyleVolume.NATURALE, TargetAudience.MASCHILE, "#9B9B9B", "salt and pepper"),
        beard("14", "Viso rasato pulito", StyleLength.RASATO, StyleVolume.PIATTO, TargetAudience.MASCHILE, "#00000000", "clean shave"),
        beard("15", "Barba lunga intrecciata", StyleLength.EXTRA_LUNGO, StyleVolume.SCOLPITO, TargetAudience.MASCHILE, "#2B1B12", "braided beard"),
    )

    val makeupLooks: List<StyleCatalogEntry> = listOf(
        makeup("01", "Nude naturale da giorno", 0.25f, "#C9A784", "natural nude"),
        makeup("02", "Cat eye smokey", 0.8f, "#1A1A1A", "smokey eye", "cat eye"),
        makeup("03", "Rossetto rosso classico", 0.6f, "#B01030", "red lip"),
        makeup("04", "Glow estivo (dewy skin)", 0.4f, "#E8B98F", "dewy", "glow"),
        makeup("05", "Trucco sposa soft glam", 0.55f, "#D9A6A0", "bridal", "soft glam"),
        makeup("06", "Occhio bronzo caldo", 0.5f, "#A0692E", "bronze eye"),
        makeup("07", "Labbra nude effetto matte", 0.35f, "#B98868", "nude matte lip"),
        makeup("08", "Trucco serale glitter", 0.85f, "#8A6BB1", "glitter", "sera"),
        makeup("09", "Sopracciglia scolpite laminate", 0.3f, "#3B2A1F", "brow lamination"),
        makeup("10", "Blush pesca luminoso", 0.3f, "#F2A488", "peach blush"),
        makeup("11", "Contouring scolpito", 0.5f, "#8A5A3B", "contouring"),
        makeup("12", "Eyeliner grafico colorato", 0.6f, "#1F6FB2", "graphic liner"),
        makeup("13", "Trucco autunnale toni caldi", 0.55f, "#8C4A2B", "autumn look"),
        makeup("14", "Trucco invernale toni freddi", 0.55f, "#5A4A8C", "winter look"),
        makeup("15", "No-makeup makeup", 0.15f, "#D8B79A", "no makeup look"),
        makeup("16", "Occhio rosa millennial", 0.45f, "#D98CA0", "millennial pink"),
        makeup("17", "Trucco anni '90 grunge", 0.6f, "#6B2E3B", "90s grunge"),
        makeup("18", "Halo eye luminoso", 0.5f, "#C99A5B", "halo eye"),
        makeup("19", "Baffetto highlighter scolpito", 0.4f, "#F0D9A8", "strobing"),
        makeup("20", "Trucco editoriale audace", 0.9f, "#101010", "editorial", "avant-garde"),
    )

    fun tutti(): List<StyleCatalogEntry> = hairstyles + beardsAndMustaches + makeupLooks

    fun perCategoria(categoria: StyleCategory): List<StyleCatalogEntry> = when (categoria) {
        StyleCategory.CAPELLI -> hairstyles
        StyleCategory.BARBA -> beardsAndMustaches
        StyleCategory.TRUCCO -> makeupLooks
    }
}
