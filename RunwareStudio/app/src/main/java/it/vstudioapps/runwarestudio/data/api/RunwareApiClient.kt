package it.vstudioapps.runwarestudio.data.api

import it.vstudioapps.runwarestudio.BuildConfig
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Thin client for Runware's REST API: a single endpoint (POST /v1) that accepts a JSON array
 * of tasks and returns a JSON array of results, matched by taskUUID. No SDK dependency —
 * the protocol is simple enough that OkHttp + kotlinx.serialization cover it directly.
 *
 * [apiKeyProvider] is read fresh on every call instead of captured once, so a key the user
 * just pasted into Settings is picked up immediately without recreating this client.
 */
class RunwareApiClient(
    private val apiKeyProvider: suspend () -> String?,
    private val baseUrl: String = BuildConfig.RUNWARE_API_BASE_URL
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    /** Uploads one reference image (as a `data:<mime>;base64,...` URI) and returns the
     *  imageUUID Runware assigns it, which imageInference then references by id — see
     *  runware.ai/docs/utilities/image-upload. */
    suspend fun uploadImage(dataUri: String): Result<String> = withContext(Dispatchers.IO) {
        val taskUUID = UUID.randomUUID().toString()
        val body = buildJsonArray {
            addJsonObject {
                put("taskType", "imageUpload")
                put("taskUUID", taskUUID)
                put("image", dataUri)
            }
        }
        executeRaw(body).mapCatching { envelope ->
            val result = envelope.data?.firstOrNull { it.taskUUID == taskUUID }
                ?: throw RunwareException(
                    envelope.errors?.firstOrNull()?.message
                        ?: envelope.error?.message
                        ?: "Caricamento immagine di riferimento non riuscito"
                )
            result.imageUUID ?: throw RunwareException("Runware non ha restituito un imageUUID")
        }
    }

    /** Runs one imageInference task and returns every result image it produced
     *  (numberResults > 1 means several images share the same taskUUID). */
    suspend fun generateImages(request: ImageInferenceRequest): Result<List<GeneratedImage>> =
        withContext(Dispatchers.IO) {
            val taskUUID = UUID.randomUUID().toString()
            val body = buildJsonArray {
                addJsonObject {
                    put("taskType", "imageInference")
                    put("taskUUID", taskUUID)
                    put("positivePrompt", request.positivePrompt)
                    if (request.negativePrompt.isNotBlank()) {
                        put("negativePrompt", request.negativePrompt)
                    }
                    put("model", request.model)
                    put("width", request.width)
                    put("height", request.height)
                    put("steps", request.steps)
                    put("CFGScale", request.cfgScale)
                    put("numberResults", request.numberResults)
                    if (!request.scheduler.equals("Default", ignoreCase = true)) {
                        put("scheduler", request.scheduler)
                    }
                    request.seed?.let { put("seed", it) }
                    put("outputType", "URL")
                    put("outputFormat", "PNG")
                    put("checkNSFW", request.checkNsfw)

                    if (request.referenceImageUUIDs.isNotEmpty()) {
                        when (request.referenceMode) {
                            ReferenceMode.ACE_PLUS_PLUS -> putJsonArray("referenceImages") {
                                request.referenceImageUUIDs.forEach { add(it) }
                            }
                            ReferenceMode.PULID -> putJsonObject("puLID") {
                                putJsonArray("images") {
                                    request.referenceImageUUIDs.forEach { add(it) }
                                }
                                put("idWeight", request.referenceStrength)
                                put("trueCFGScale", 3.5)
                                put("CFGStartStep", 4)
                            }
                            ReferenceMode.IMG2IMG -> {
                                put("seedImage", request.referenceImageUUIDs.first())
                                put("strength", request.referenceStrength)
                            }
                            ReferenceMode.NONE -> {}
                        }
                    }
                }
            }
            executeRaw(body).mapCatching { envelope ->
                val results = envelope.data?.filter { it.taskUUID == taskUUID }
                if (results.isNullOrEmpty()) {
                    val message = envelope.errors?.firstOrNull()?.message
                        ?: envelope.error?.message
                        ?: "Generazione non riuscita: risposta vuota da Runware"
                    throw RunwareException(message)
                }
                results.map {
                    GeneratedImage(
                        taskUUID = it.taskUUID ?: taskUUID,
                        imageUUID = it.imageUUID,
                        remoteUrl = it.imageURL,
                        base64 = it.imageBase64Data,
                        seed = it.seed
                    )
                }
            }
        }

    /** Round-trips a trivial 1-step generation just to validate the API key from Settings'
     *  "Testa connessione" button, without spending real generation credits/time. */
    suspend fun testConnection(): Result<Unit> = withContext(Dispatchers.IO) {
        val taskUUID = UUID.randomUUID().toString()
        val body = buildJsonArray {
            addJsonObject {
                put("taskType", "imageInference")
                put("taskUUID", taskUUID)
                put("positivePrompt", "connection test")
                put("model", "runware:100@1")
                put("width", 512)
                put("height", 512)
                put("steps", 1)
                put("CFGScale", 1)
                put("numberResults", 1)
                put("outputType", "URL")
                put("outputFormat", "PNG")
                put("checkNSFW", true)
            }
        }
        executeRaw(body).mapCatching { envelope ->
            if (envelope.data.isNullOrEmpty()) {
                val message = envelope.errors?.firstOrNull()?.message
                    ?: envelope.error?.message
                    ?: "La API key non sembra valida"
                throw RunwareException(message)
            }
        }
    }

    private suspend fun executeRaw(body: JsonArray): Result<RunwareEnvelope> = try {
        val apiKey = apiKeyProvider()
        if (apiKey.isNullOrBlank()) {
            Result.failure(RunwareException("Inserisci la tua API key di Runware nelle Impostazioni"))
        } else {
            val httpRequest = Request.Builder()
                .url(baseUrl)
                .addHeader("Authorization", "Bearer $apiKey")
                .addHeader("Content-Type", "application/json")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()
            client.newCall(httpRequest).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (text.isBlank()) {
                    Result.failure(RunwareException("Errore di rete: HTTP ${response.code}"))
                } else {
                    Result.success(json.decodeFromString(RunwareEnvelope.serializer(), text))
                }
            }
        }
    } catch (e: Exception) {
        Result.failure(RunwareException(e.message ?: "Errore di connessione a Runware", e))
    }
}
