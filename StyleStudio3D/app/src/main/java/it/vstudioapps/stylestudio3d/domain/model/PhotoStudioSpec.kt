package it.vstudioapps.stylestudio3d.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class CameraFraming(val etichetta: String, val descrizione: String) {
    VISO("Solo viso", "Primo piano su viso, capelli e trucco."),
    MEZZO_BUSTO("Mezzo busto", "Dalla vita in su: ideale per top, giacche e collane."),
    FIGURA_INTERA("Figura intera", "Corpo intero: mostra anche pantaloni/gonna e scarpe."),
}

@Serializable
enum class CameraAngle(val etichetta: String) {
    FRONTALE("Frontale"),
    TRE_QUARTI("Tre quarti"),
    LATERALE("Laterale (profilo)"),
    DALL_ALTO("Leggermente dall'alto"),
    DAL_BASSO("Leggermente dal basso (eroico)"),
}

@Serializable
enum class LightingPreset(val etichetta: String, val tintaHex: String) {
    NATURALE("Luce naturale morbida", "#FFF6E8"),
    STUDIO_SOFT("Studio softbox", "#FFFFFF"),
    DRAMMATICA("Drammatica laterale", "#DDE3F0"),
    GOLDEN_HOUR("Golden hour", "#FFCE8A"),
    NEON("Neon serale", "#B98CFF"),
}

@Serializable
enum class BackgroundEnvironment(val etichetta: String, val colorHex: String) {
    STUDIO_GRIGIO("Set grafico grigio", "#8A8A90"),
    PARETE_BIANCA("Parete bianca", "#F5F5F5"),
    BOUTIQUE("Boutique elegante", "#5B4636"),
    OUTDOOR_URBANO("Set urbano", "#7793A3"),
    GRADIENTE_COLORE("Fondale a gradiente colorato", "#7A5CFF"),
}

/**
 * La "regia" scelta dall'utente in Studio Fotografico: e' l'ultimo passaggio prima di generare
 * lo scatto finale, che unisce capelli/barba/trucco/outfit gia' scelti altrove nella sessione.
 */
@Serializable
data class PhotoStudioSpec(
    val framing: CameraFraming = CameraFraming.MEZZO_BUSTO,
    val angle: CameraAngle = CameraAngle.FRONTALE,
    val lighting: LightingPreset = LightingPreset.STUDIO_SOFT,
    val background: BackgroundEnvironment = BackgroundEnvironment.STUDIO_GRIGIO,
)
