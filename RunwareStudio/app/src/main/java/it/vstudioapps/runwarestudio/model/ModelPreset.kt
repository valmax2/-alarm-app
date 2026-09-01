package it.vstudioapps.runwarestudio.model

import it.vstudioapps.runwarestudio.data.api.ReferenceMode

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
    /** Pre-fills "Parametri avanzati" -> Prompt negativo when this model is selected, tuned to
     *  what that specific checkpoint's community generally uses (a Pony-family model wants its
     *  low-score tags here, a photoreal one wants anatomy/artifact terms, etc.) — same as every
     *  other default here, always editable afterwards, never sent silently unmodified. */
    val defaultNegativePrompt: String = "",
    /** True if this checkpoint is commonly used for uncensored/adult-content generation. Only
     *  affects a small "18+" badge in the picker — the app never blocks a prompt by category,
     *  the NSFW-filter toggle in Settings is the only gate. */
    val adultCapable: Boolean = false,
    /** How reference photos get sent for this model — see ReferenceMode. Defaults to PULID
     *  (good face consistency with almost any SDXL-family checkpoint); ACE++ itself and the
     *  FLUX models (uncertain PuLID-FLUX field compatibility, untested) override it. */
    val referenceMode: ReferenceMode = ReferenceMode.PULID
)

enum class ModelCategory(val label: String) {
    GENERAL("Generale"),
    REALISTIC("Fotorealistico"),
    ANIME("Anime / Illustrazione"),
    ARTISTIC("Artistico"),
    ADULT("Adulti (18+)"),
    CHARACTER_CONSISTENCY("Coerenza personaggio")
}
