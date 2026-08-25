package it.vstudioapps.stylestudio3d.ui.render

import it.vstudioapps.stylestudio3d.domain.model.BackgroundEnvironment
import it.vstudioapps.stylestudio3d.domain.model.CameraFraming
import it.vstudioapps.stylestudio3d.domain.model.LightingPreset
import it.vstudioapps.stylestudio3d.domain.model.StyleAttributes

/**
 * Tutto cio' che serve a [MannequinRenderer] per disegnare un fotogramma. E' un semplice bag di
 * dati (nessuna logica): la stessa istanza puo' essere usata sia per la preview live in Compose
 * sia per rasterizzare lo scatto finale su un Bitmap fuori dalla UI.
 */
data class MannequinParams(
    /** -80..80: 0 = frontale, negativo/positivo = rotazione verso i due profili. Niente vista posteriore. */
    val rotazioneGradi: Float = 0f,
    val capelli: StyleAttributes? = null,
    val barba: StyleAttributes? = null,
    val trucco: StyleAttributes? = null,
    val colorePelle: String = "#D9A97A",
    val coloreTop: String? = null,
    val colorePantaloni: String? = null,
    val coloreAbito: String? = null,
    val coloreOuterwear: String? = null,
    val coloreScarpe: String? = null,
    val inquadratura: CameraFraming = CameraFraming.FIGURA_INTERA,
    val illuminazione: LightingPreset = LightingPreset.STUDIO_SOFT,
    val sfondo: BackgroundEnvironment = BackgroundEnvironment.STUDIO_GRIGIO,
)
