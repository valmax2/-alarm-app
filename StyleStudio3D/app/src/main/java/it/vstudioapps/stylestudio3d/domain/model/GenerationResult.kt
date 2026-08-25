package it.vstudioapps.stylestudio3d.domain.model

import kotlinx.serialization.Serializable

/** Da dove arriva effettivamente il pixel finale: distinzione mostrata onestamente in UI. */
@Serializable
enum class GenerationSource {
    /** Composito disegnato dal renderer procedurale interno (nessuna rete, sempre disponibile). */
    ANTEPRIMA_LOCALE,
    /** Prodotto da un servizio IA esterno tramite l'abbonamento configurato dall'utente. */
    ABBONAMENTO_AI,
    /** Importato dopo essere stato generato manualmente in una chat AI esterna (es. ChatGPT). */
    CHAT_ESTERNA,
}

/** Uno scatto salvato nella cronologia delle creazioni (sincronizzabile su Google Drive). */
@Serializable
data class GenerationResult(
    val id: String,
    val imagePath: String,
    val source: GenerationSource,
    val studioSpec: PhotoStudioSpec,
    val hairEntryId: String?,
    val beardEntryId: String?,
    val makeupEntryId: String?,
    val outfitItemIds: List<String>,
    val createdAtEpochMillis: Long,
)
