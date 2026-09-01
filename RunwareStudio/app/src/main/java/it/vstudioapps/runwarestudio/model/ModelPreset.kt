package it.vstudioapps.runwarestudio.model

/**
 * One entry in the curated "modelli pronti all'uso" catalog shown in the model picker. [air]
 * is Runware's model identifier format (AIR — "civitai:<model>@<version>" or
 * "runware:<id>@<version>"), passed verbatim as the `model` field of an imageInference task.
 *
 * These defaults are starting points the user can always override in "Parametri avanzati" —
 * nothing here is enforced server-side, it just saves re-typing sane values for each model.
 */
data class ModelPreset(
    val id: String,
    val air: String,
    val displayName: String,
    val description: String,
    val category: ModelCategory,
    val defaultSteps: Int,
    val defaultCfgScale: Float,
    val defaultWidth: Int,
    val defaultHeight: Int,
    val defaultScheduler: String,
    /** True if this checkpoint is commonly used for uncensored/adult-content generation. Only
     *  affects a small "18+" badge in the picker — the app never blocks a prompt by category,
     *  the NSFW-filter toggle in Settings is the only gate. */
    val adultCapable: Boolean = false,
    /** Set for models that support Runware's ACE++ character-consistent editing
     *  (model = "runware:102@1"), which is what powers the "immagini di riferimento
     *  personaggio" feature end to end instead of a plain img2img strength blend. */
    val supportsCharacterReference: Boolean = false
)

enum class ModelCategory(val label: String) {
    GENERAL("Generale"),
    REALISTIC("Fotorealistico"),
    ANIME("Anime / Illustrazione"),
    ARTISTIC("Artistico"),
    ADULT("Adulti (18+)"),
    CHARACTER_CONSISTENCY("Coerenza personaggio")
}
