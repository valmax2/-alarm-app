package it.vstudioapps.stylestudio3d.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class GarmentCategory(val etichetta: String) {
    TOP("Top/Maglie"),
    PANTALONI("Pantaloni/Gonne"),
    ABITO("Abiti/Completi"),
    OUTERWEAR("Giacche/Cappotti"),
    SCARPE("Scarpe"),
}

/**
 * Un capo del guardaroba virtuale: nasce sempre da una foto reale caricata dall'utente (mai
 * generata), coerentemente con "prova virtuale tramite caricamento foto". [dominantColorHex]
 * viene estratto automaticamente dalla foto e usato dall'analisi dell'armocromia per capire
 * quali capi del guardaroba si abbinano alla stagione cromatica dell'utente.
 */
@Serializable
data class WardrobeItem(
    val id: String,
    val category: GarmentCategory,
    val name: String,
    /** Percorso del file immagine copiato nello storage privato dell'app. */
    val photoPath: String,
    val dominantColorHex: String,
    val createdAtEpochMillis: Long,
)
