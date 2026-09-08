package it.vstudioapps.runwarestudio.data.api

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Client for Segmind's Faceswap V2 model API — used as a post-processing step after Runware
 * generates an image, for models Runware's own identity techniques (PuLID) reject (every
 * Civitai/Pony checkpoint — see ModelPreset.referenceMode). Segmind swaps a face onto an
 * already-generated image, so it doesn't care what model produced that image or whether it's
 * NSFW; only Runware's own checkNSFW flag governs that part.
 *
 * IMPORTANT — unverified against a live account: runware.ai *and* segmind.com are both
 * unreachable from the sandbox this was written in, so this is built from search-indexed
 * documentation snippets only, the same way the first PuLID attempt was — and that one turned
 * out backwards on a real API call. Treat the exact field names/endpoint here as a
 * best-effort first pass likely to need a correction once tried against a real account,
 * exactly like PuLID did.
 */
class SegmindApiClient(private val apiKeyProvider: suspend () -> String?) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    /** [sourceFaceBase64] is the reference photo (raw base64, no "data:...;base64," prefix) —
     *  the face that should appear in the result. [targetImageUrl] is the already-generated
     *  image (Runware hands back a plain https URL) whose face gets replaced. Returns the
     *  swapped image's raw bytes. */
    suspend fun swapFace(sourceFaceBase64: String, targetImageUrl: String): Result<ByteArray> =
        withContext(Dispatchers.IO) {
            val apiKey = apiKeyProvider()
            if (apiKey.isNullOrBlank()) {
                return@withContext Result.failure(
                    RunwareException("Aggiungi la tua API key di Segmind nelle Impostazioni")
                )
            }
            val json = JSONObject().apply {
                put("source_img", sourceFaceBase64)
                put("target_img", targetImageUrl)
                put("input_faces_index", "0")
                put("source_faces_index", "0")
                put("face_restore", "codeformer-v0.1.0.pth")
                put("base64", false)
            }
            val request = Request.Builder()
                .url(FACESWAP_URL)
                .addHeader("x-api-key", apiKey)
                .addHeader("Content-Type", "application/json")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .build()

            // Same rationale as RunwareApiClient: a dropped mobile connection mid-request
            // shouldn't surface as a failure on the first attempt — one silent retry first.
            var lastIoError: IOException? = null
            repeat(2) { attempt ->
                try {
                    client.newCall(request).execute().use { response ->
                        val bytes = response.body?.bytes()
                        val contentType = response.body?.contentType()?.toString().orEmpty()
                        return@withContext if (!response.isSuccessful || bytes == null) {
                            val message = bytes?.let { runCatching { String(it) }.getOrNull() }
                                ?: "Errore Segmind: HTTP ${response.code}"
                            Result.failure(RunwareException(message))
                        } else if (contentType.startsWith("application/json")) {
                            // Some Segmind error paths return JSON even on a 200; surface it as
                            // text rather than trying to save it as an image.
                            Result.failure(RunwareException(String(bytes)))
                        } else {
                            Result.success(bytes)
                        }
                    }
                } catch (e: IOException) {
                    lastIoError = e
                    if (attempt == 0) delay(1500)
                } catch (e: Exception) {
                    return@withContext Result.failure(RunwareException(e.message ?: "Errore di connessione a Segmind", e))
                }
            }
            Result.failure(
                RunwareException(
                    "Connessione persa con Segmind. Controlla la connessione internet e riprova.",
                    lastIoError
                )
            )
        }

    private companion object {
        const val FACESWAP_URL = "https://api.segmind.com/v1/faceswap-v2"
    }
}
