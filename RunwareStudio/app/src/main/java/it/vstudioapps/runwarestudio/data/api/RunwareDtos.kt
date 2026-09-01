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
    val referenceStrength: Float = 0.55f,
    /** True -> send referenceImageUUIDs as `referenceImages` (ACE++ character consistency,
     *  model runware:102@1). False -> classic img2img via `seedImage` + `strength`, using
     *  only the first reference image. */
    val useCharacterConsistency: Boolean = false
)

class RunwareException(message: String, cause: Throwable? = null) : Exception(message, cause)
