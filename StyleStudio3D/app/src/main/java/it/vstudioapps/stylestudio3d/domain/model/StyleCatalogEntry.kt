package it.vstudioapps.stylestudio3d.domain.model

import kotlinx.serialization.Serializable

/**
 * Una voce del catalogo stili: sia quelle "di serie" ([StyleCatalogSeed]) sia quelle create
 * dall'utente dalla schermata "Crea nuovo stile". Il nome e' testo libero — l'utente puo'
 * scriverlo in italiano, inglese o qualunque lingua, non e' vincolato a un elenco chiuso.
 */
@Serializable
data class StyleCatalogEntry(
    val id: String,
    val category: StyleCategory,
    val name: String,
    val attributes: StyleAttributes,
    /** Falso per le voci create dall'utente: permette di distinguerle e di poterle eliminare. */
    val isBuiltIn: Boolean = false,
    /**
     * Percorso file locale di una miniatura fotorealistica importata dall'utente (es. generata
     * in locale con ComfyUI o altro strumento AI). Se null, l'anteprima viene disegnata al volo
     * dal renderer procedurale in base a [attributes] — cosi ogni voce, comprese quelle create
     * al momento, ha sempre un'anteprima coerente anche senza immagine reale.
     */
    val importedPreviewPath: String? = null,
    val createdAtEpochMillis: Long = 0L,
)
