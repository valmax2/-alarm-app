package it.vstudioapps.stylestudio3d.domain.model

import kotlinx.serialization.Serializable

/**
 * Le quattro stagioni cromatiche dell'armocromia classica. Ogni stagione porta con se' una
 * palette di colori consigliati (usata sia per i suggerimenti sia per evidenziare i capi del
 * guardaroba virtuale piu' vicini a questi colori).
 */
@Serializable
enum class ColorSeason(
    val etichetta: String,
    val descrizione: String,
    val paletteHex: List<String>,
) {
    PRIMAVERA(
        "Primavera calda",
        "Sottotono caldo, colori chiari e brillanti: valorizzano freschezza e luminosita' naturale.",
        listOf("#FF7F50", "#FFD700", "#7FFFD4", "#FF6F61", "#9ACD32", "#F4A460", "#40E0D0", "#FFB347"),
    ),
    ESTATE(
        "Estate fredda",
        "Sottotono freddo, colori chiari e tenui: valorizzano un incarnato delicato e poco contrastato.",
        listOf("#B0C4DE", "#C8A2C8", "#87A7B3", "#D8BFD8", "#8FA6B2", "#A2A2D0", "#9FB6CD", "#B7CADB"),
    ),
    AUTUNNO(
        "Autunno caldo",
        "Sottotono caldo, colori profondi e terrosi: valorizzano incarnati dorati o olivastri.",
        listOf("#8B4513", "#B8860B", "#6B8E23", "#A0522D", "#CD853F", "#556B2F", "#800000", "#DAA520"),
    ),
    INVERNO(
        "Inverno freddo",
        "Sottotono freddo, colori profondi e brillanti: valorizzano un forte contrasto naturale.",
        listOf("#000080", "#8B0000", "#4B0082", "#008080", "#FFFFFF", "#000000", "#DC143C", "#2F4F4F"),
    ),
}
