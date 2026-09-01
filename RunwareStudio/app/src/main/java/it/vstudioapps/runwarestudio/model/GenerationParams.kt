package it.vstudioapps.runwarestudio.model

/**
 * Every knob the user can tweak for one generation, pre-filled from a [ModelPreset] and then
 * freely editable. Mirrors the fields Runware's imageInference task accepts 1:1 so building
 * the request is a straight copy (see data/api/RunwareApiClient.kt).
 */
data class GenerationParams(
    val negativePrompt: String = "",
    val steps: Int = 30,
    val cfgScale: Float = 7f,
    val width: Int = 1024,
    val height: Int = 1024,
    val scheduler: String = "Default",
    val numberResults: Int = 1,
    /** Blank = random seed picked by Runware for every result. */
    val seed: Long? = null,
    /** How strongly reference images steer the result, 0..1. Only sent when at least one
     *  reference image is attached (img2img `strength`, or ACE++'s equivalent blend). */
    val referenceStrength: Float = 0.55f,
    /** Runware's own NSFW checker. True (default) leaves it on. Can only be switched off
     *  from Home once the user has completed the 18+ consent gate in Settings — see
     *  SettingsRepository.adultContentEnabled. */
    val checkNsfw: Boolean = true
) {
    companion object {
        val COMMON_RESOLUTIONS = listOf(
            512 to 512,
            768 to 768,
            1024 to 1024,
            832 to 1216,
            1216 to 832,
            896 to 1152,
            1152 to 896
        )

        val SCHEDULERS = listOf(
            "Default", "Euler", "Euler A", "DPM++ 2M", "DPM++ 2M Karras",
            "DPM++ SDE Karras", "DDIM", "UniPC"
        )
    }
}

fun ModelPreset.toDefaultParams(): GenerationParams = GenerationParams(
    negativePrompt = defaultNegativePrompt,
    steps = defaultSteps,
    cfgScale = defaultCfgScale,
    width = defaultWidth,
    height = defaultHeight,
    scheduler = defaultScheduler
)
