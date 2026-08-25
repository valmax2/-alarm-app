package it.vstudioapps.stylestudio3d.ui.session

import it.vstudioapps.stylestudio3d.domain.model.ColorSeason
import it.vstudioapps.stylestudio3d.domain.model.GarmentCategory
import it.vstudioapps.stylestudio3d.domain.model.GenerationResult
import it.vstudioapps.stylestudio3d.domain.model.GenerationSource
import it.vstudioapps.stylestudio3d.domain.model.PhotoStudioSpec

/** Tutte le scelte fatte durante una sessione di styling: capelli/barba/trucco + outfit + regia dello studio. */
data class StyleSessionState(
    val hairEntryId: String? = null,
    val beardEntryId: String? = null,
    val makeupEntryId: String? = null,
    val outfitPerCategoria: Map<GarmentCategory, String> = emptyMap(),
    val colorSeason: ColorSeason? = null,
    val studioSpec: PhotoStudioSpec = PhotoStudioSpec(),
    /** Foto reale dell'utente dopo un editing IA (capelli/barba/trucco/try-on), se presente. */
    val fotoUtenteModificataPath: String? = null,
    val fonteFotoUtente: GenerationSource? = null,
    val ultimoRisultato: GenerationResult? = null,
)
