package it.vstudioapps.voiceclonestudio.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Client per il server locale gratuito (server/xtts_server.py in questo repository), che
 * l'utente fa girare sul proprio PC. Nessuna chiave API: solo un indirizzo IP sulla rete di
 * casa. Copre solo il text-to-speech — XTTS-v2 non fa conversione voce→voce.
 */
class XttsServerApi {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        // La primissima generazione dopo l'avvio del server può richiedere a lungo (caricamento
        // del modello); le successive sono più veloci ma comunque non istantanee su CPU.
        .readTimeout(180, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .build()

    suspend fun checkConnection(baseUrl: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url("${normalize(baseUrl)}/health").get().build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IOException("Il server ha risposto con un errore (${response.code})")
                }
            }
        }
    }

    suspend fun textToSpeech(
        baseUrl: String,
        text: String,
        language: String,
        speed: Float,
        speakerSamples: List<File>,
        outputFile: File
    ): Result<File> = withContext(Dispatchers.IO) {
        runCatching {
            if (speakerSamples.isEmpty()) {
                throw IOException("Nessun campione audio per questa voce")
            }

            val bodyBuilder = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("text", text)
                .addFormDataPart("language", language)
                .addFormDataPart("speed", speed.toString())

            speakerSamples.forEach { file ->
                bodyBuilder.addFormDataPart(
                    "speaker_wav",
                    file.name,
                    file.asRequestBody("audio/*".toMediaType())
                )
            }

            val request = Request.Builder()
                .url("${normalize(baseUrl)}/tts")
                .post(bodyBuilder.build())
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val detail = try { response.body?.string() } catch (e: IOException) { null }
                    throw IOException(
                        detail?.takeIf { it.isNotBlank() }?.take(300)
                            ?: "Il server ha risposto con un errore (${response.code}). " +
                                "È acceso? È sulla stessa rete WiFi del telefono?"
                    )
                }
                val bytes = response.body?.bytes()
                    ?: throw IOException("Il server non ha restituito audio")
                outputFile.parentFile?.mkdirs()
                outputFile.writeBytes(bytes)
                outputFile
            }
        }
    }

    private fun normalize(baseUrl: String): String = baseUrl.trim().trimEnd('/')
}
