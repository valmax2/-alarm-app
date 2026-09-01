package it.vstudioapps.runwarestudio.data.api

import kotlinx.serialization.Serializable

/**
 * Wire shape of every Runware REST response (POST https://api.runware.ai/v1). A single call
 * can carry results for several tasks at once, matched back to the request via [taskUUID] —
 * see runware.ai/docs/image-inference/api-reference. `ignoreUnknownKeys` is on when decoding
 * this (see RunwareApiClient) since Runware's payloads carry more fields than this app uses.
 */
@Serializable
data class RunwareEnvelope(
    val data: List<RunwareResultDto>? = null,
    val errors: List<RunwareErrorDto>? = null,
    val error: RunwareErrorDto? = null
)

@Serializable
data class RunwareResultDto(
    val taskType: String? = null,
    val taskUUID: String? = null,
    val imageUUID: String? = null,
    val imageURL: String? = null,
    val imageBase64Data: String? = null,
    val seed: Long? = null,
    val cost: Double? = null
)

@Serializable
data class RunwareErrorDto(
    val code: String? = null,
    val message: String? = null,
    val taskUUID: String? = null,
    val parameter: String? = null
)

/** Domain-level result of one generated image, independent of whether Runware handed it back
 *  as a URL or inline base64 (outputType is always requested as "URL" today, but the field is
 *  kept so a future outputType switch doesn't ripple through the whole app). */
data class GeneratedImage(
    val taskUUID: String,
    val imageUUID: String?,
    val remoteUrl: String?,
    val base64: String?,
    val seed: Long?
)

/** How [ImageInferenceRequest.referenceImageUUIDs] get attached to the task, chosen by
 *  GenerationViewModel from the selected model — see ModelPreset.referenceMode. */
enum class ReferenceMode {
    /** No reference images attached. */
    NONE,
    /** ACE++ character-consistent editing — requires model = "runware:102@1", sends every
     *  reference image via `referenceImages`. */
    ACE_PLUS_PLUS,
    /** PuLID identity transfer (`puLID` object: images + idWeight/trueCFGScale/CFGStartStep) —
     *  works alongside most SDXL-family checkpoints (photoreal/anime/artistic/Pony), giving
     *  much better face consistency than plain img2img without needing a dedicated model. */
    PULID,
    /** Classic img2img (`seedImage` + `strength`, first reference image only) — the fallback
     *  for models PuLID isn't confirmed compatible with (FLUX's own identity technique is a
     *  separate PuLID-FLUX variant this app doesn't send). */
    IMG2IMG
}

/** Everything RunwareApiClient.generateImages needs — a flattened, already-resolved view of
 *  GenerationParams + prompt strings + model AIR + any uploaded reference image UUIDs. */
data class ImageInferenceRequest(
    val positivePrompt: String,
    val negativePrompt: String,
    val model: String,
    val width: Int,
    val height: Int,
    val steps: Int,
    val cfgScale: Float,
    val numberResults: Int,
    val scheduler: String,
    val seed: Long?,
    val checkNsfw: Boolean,
    val referenceImageUUIDs: List<String> = emptyList(),
    /** 0.1–1.0 from the UI slider. Used as img2img `strength` for [ReferenceMode.IMG2IMG], or
     *  as PuLID `idWeight` for [ReferenceMode.PULID] (PuLID's own range is 0–3; the slider's
     *  0.1–1.0 stays a safe, well-tested subset of that rather than exposing the full range). */
    val referenceStrength: Float = 0.55f,
    val referenceMode: ReferenceMode = ReferenceMode.NONE
)

class RunwareException(message: String, cause: Throwable? = null) : Exception(message, cause)
