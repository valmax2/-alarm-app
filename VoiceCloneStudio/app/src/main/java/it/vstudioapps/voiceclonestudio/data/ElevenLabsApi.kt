package it.vstudioapps.voiceclonestudio.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Client minimale per le API REST di ElevenLabs (https://elevenlabs.io) usate da questa app:
 * clonazione istantanea della voce, text-to-speech e speech-to-speech (conversione voce→voce).
 *
 * Non è un SDK completo: copre solo le chiamate che l'app usa, con parsing manuale via
 * kotlinx.serialization e gestione errori pensata per essere mostrata direttamente in UI.
 */
class ElevenLabsApi {

    private val json = Json { ignoreUnknownKeys = true }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        // La generazione di un audio lungo (TTS/STS) può richiedere più di qualche secondo:
        // un timeout troppo corto qui produrrebbe falsi errori di rete.
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()

    suspend fun validateApiKey(apiKey: String): Result<UserResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("$BASE_URL/v1/user")
                .header("xi-api-key", apiKey)
                .get()
                .build()
            executeAndParse<UserResponse>(request)
        }
    }

    suspend fun listVoices(apiKey: String): Result<List<ClonedVoice>> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("$BASE_URL/v1/voices")
                .header("xi-api-key", apiKey)
                .get()
                .build()
            executeAndParse<VoicesResponse>(request).voices
        }
    }

    suspend fun addVoice(
        apiKey: String,
        name: String,
        description: String?,
        sampleFiles: List<File>
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val bodyBuilder = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("name", name)

            if (!description.isNullOrBlank()) {
                bodyBuilder.addFormDataPart("description", description)
            }

            sampleFiles.forEach { file ->
                bodyBuilder.addFormDataPart(
                    "files",
                    file.name,
                    file.asRequestBody(guessAudioMediaType(file))
                )
            }

            val request = Request.Builder()
                .url("$BASE_URL/v1/voices/add")
                .header("xi-api-key", apiKey)
                .post(bodyBuilder.build())
                .build()

            val responseFields = executeAndParseRaw(request)
            responseFields["voice_id"]?.toString()?.trim('"')
                ?: throw ElevenLabsException("Risposta inattesa dal server: manca voice_id")
        }
    }

    suspend fun deleteVoice(apiKey: String, voiceId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("$BASE_URL/v1/voices/$voiceId")
                .header("xi-api-key", apiKey)
                .delete()
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw errorFor(response)
            }
        }
    }

    suspend fun textToSpeech(
        apiKey: String,
        voiceId: String,
        text: String,
        model: TtsModel,
        languageCode: String?,
        settings: VoiceGenerationSettings,
        outputFile: File
    ): Result<File> = withContext(Dispatchers.IO) {
        runCatching {
            val bodyJson = buildJsonObject {
                put("text", text)
                put("model_id", model.id)
                if (model.supportsLanguageCode && !languageCode.isNullOrBlank()) {
                    put("language_code", languageCode)
                }
                put("voice_settings", buildJsonObject {
                    put("stability", settings.stability)
                    put("similarity_boost", settings.similarityBoost)
                    put("style", settings.style)
                    put("use_speaker_boost", settings.speakerBoost)
                    if (model.supportsSpeed) put("speed", settings.speed)
                })
            }

            val request = Request.Builder()
                .url("$BASE_URL/v1/text-to-speech/$voiceId")
                .header("xi-api-key", apiKey)
                .header("Accept", "audio/mpeg")
                .post(bodyJson.toString().toRequestBody(JSON_MEDIA_TYPE))
                .build()

            downloadAudio(request, outputFile)
        }
    }

    suspend fun speechToSpeech(
        apiKey: String,
        voiceId: String,
        sourceFile: File,
        settings: VoiceGenerationSettings,
        removeBackgroundNoise: Boolean,
        outputFile: File
    ): Result<File> = withContext(Dispatchers.IO) {
        runCatching {
            val settingsJson = buildJsonObject {
                put("stability", settings.stability)
                put("similarity_boost", settings.similarityBoost)
                put("style", settings.style)
                put("use_speaker_boost", settings.speakerBoost)
            }.toString()

            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("model_id", STS_MODEL_ID)
                .addFormDataPart("voice_settings", settingsJson)
                .addFormDataPart("remove_background_noise", removeBackgroundNoise.toString())
                .addFormDataPart(
                    "audio",
                    sourceFile.name,
                    sourceFile.asRequestBody(guessAudioMediaType(sourceFile))
                )
                .build()

            val request = Request.Builder()
                .url("$BASE_URL/v1/speech-to-speech/$voiceId")
                .header("xi-api-key", apiKey)
                .header("Accept", "audio/mpeg")
                .post(body)
                .build()

            downloadAudio(request, outputFile)
        }
    }

    private fun downloadAudio(request: Request, outputFile: File): File {
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw errorFor(response)
            val bytes = response.body?.bytes()
                ?: throw ElevenLabsException("Il server non ha restituito audio")
            outputFile.parentFile?.mkdirs()
            outputFile.writeBytes(bytes)
            return outputFile
        }
    }

    private inline fun <reified T> executeAndParse(request: Request): T {
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw errorFor(response)
            val bodyString = response.body?.string() ?: "{}"
            return json.decodeFromString(bodyString)
        }
    }

    private fun executeAndParseRaw(request: Request): Map<String, Any?> {
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw errorFor(response)
            val bodyString = response.body?.string() ?: "{}"
            val element = json.parseToJsonElement(bodyString)
            return element.jsonObject.mapValues { it.value.toString() }
        }
    }

    private fun errorFor(response: Response): ElevenLabsException {
        val bodyString = try {
            response.body?.string()
        } catch (e: IOException) {
            null
        }
        val friendly = when (response.code) {
            401 -> "Chiave API rifiutata da ElevenLabs."
            402, 429 -> "Hai raggiunto il limite del tuo piano ElevenLabs (caratteri o voci disponibili)."
            413 -> "I file audio caricati sono troppo grandi."
            else -> null
        }
        // Il corpo dell'errore ElevenLabs non ha sempre la stessa forma (a volte "detail" è un
        // oggetto {status, message}, a volte una semplice stringa) — se il parsing strutturato
        // fallisce, cadiamo comunque sul testo grezzo piuttosto che perderlo del tutto.
        val detailMessage = bodyString?.takeIf { it.isNotBlank() }?.let { raw ->
            runCatching { json.decodeFromString<ApiErrorBody>(raw).detail?.message }.getOrNull()
                ?: raw.take(200)
        }
        // Il messaggio "amichevole" (se c'è) va sempre affiancato al dettaglio grezzo del
        // server quando disponibile: nasconderlo dietro un testo fisso per i codici comuni
        // (es. 401) rende impossibile capire la vera causa quando non è quella ovvia.
        val message = when {
            friendly != null && detailMessage != null -> "$friendly ($detailMessage)"
            friendly != null -> friendly
            detailMessage != null -> detailMessage
            else -> "Errore del server ElevenLabs (${response.code}): nessun dettaglio"
        }
        return ElevenLabsException(message, response.code)
    }

    private fun guessAudioMediaType(file: File) = when (file.extension.lowercase()) {
        "mp3" -> "audio/mpeg"
        "wav" -> "audio/wav"
        "m4a", "mp4", "aac" -> "audio/mp4"
        "flac" -> "audio/flac"
        "ogg" -> "audio/ogg"
        else -> "application/octet-stream"
    }.toMediaType()

    companion object {
        private const val BASE_URL = "https://api.elevenlabs.io"
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
    }
}

class ElevenLabsException(message: String, val statusCode: Int? = null) : IOException(message)
