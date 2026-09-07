package it.vstudioapps.voiceclonestudio.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Una voce clonata così come la restituisce l'API ElevenLabs. */
@Serializable
data class ClonedVoice(
    @SerialName("voice_id") val voiceId: String,
    val name: String,
    val category: String? = null,
    @SerialName("preview_url") val previewUrl: String? = null
)

@Serializable
data class VoicesResponse(val voices: List<ClonedVoice> = emptyList())

@Serializable
data class UserSubscription(
    val tier: String? = null,
    @SerialName("character_count") val characterCount: Int? = null,
    @SerialName("character_limit") val characterLimit: Int? = null
)

@Serializable
data class UserResponse(
    @SerialName("first_name") val firstName: String? = null,
    val subscription: UserSubscription? = null
)

@Serializable
data class ApiErrorBody(val detail: ApiErrorDetail? = null)

@Serializable
data class ApiErrorDetail(
    val status: String? = null,
    val message: String? = null
)

/**
 * I quattro parametri che ElevenLabs espone per rifinire quanto una generazione somiglia alla
 * voce originale e quanto suona naturale invece che robotica. Vengono salvati e ripresentati
 * identici ad ogni generazione, cosà l'utente può aggiustarli di poco alla volta.
 */
@Serializable
data class VoiceGenerationSettings(
    val stability: Float = 0.5f,
    val similarityBoost: Float = 0.85f,
    val style: Float = 0.25f,
    val speakerBoost: Boolean = true,
    val speed: Float = 1.0f
) {
    companion object {
        /** Valori di partenza consigliati per una voce italiana naturale, non robotica. */
        val RECOMMENDED = VoiceGenerationSettings()
    }
}

data class TtsModel(
    val id: String,
    val label: String,
    val supportsLanguageCode: Boolean,
    val supportsSpeed: Boolean = true
)

val TTS_MODELS = listOf(
    TtsModel(
        id = "eleven_multilingual_v2",
        label = "Multilingual v2 — qualità migliore (consigliato per l'italiano)",
        supportsLanguageCode = false
    ),
    TtsModel(
        id = "eleven_turbo_v2_5",
        label = "Turbo v2.5 — veloce, buon italiano",
        supportsLanguageCode = true
    ),
    TtsModel(
        id = "eleven_flash_v2_5",
        label = "Flash v2.5 — massima velocità",
        supportsLanguageCode = true
    )
)

const val STS_MODEL_ID = "eleven_multilingual_sts_v2"

/** Un audio generato (TTS o conversione) salvato in locale, con le impostazioni che lo hanno prodotto. */
@Serializable
data class GeneratedClip(
    val id: String,
    val kind: ClipKind,
    val voiceName: String,
    /** Il testo letto (TTS) oppure il nome del file sorgente (conversione). */
    val sourceLabel: String,
    val modelId: String,
    val settings: VoiceGenerationSettings,
    val filePath: String,
    val createdAtEpochMillis: Long
)

@Serializable
enum class ClipKind { TEXT_TO_SPEECH, VOICE_CONVERSION }
