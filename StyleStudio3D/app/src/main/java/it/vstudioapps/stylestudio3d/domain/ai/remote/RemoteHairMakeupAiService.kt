package it.vstudioapps.stylestudio3d.domain.ai.remote

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import it.vstudioapps.stylestudio3d.domain.ai.AiOutcome
import it.vstudioapps.stylestudio3d.domain.ai.HairMakeupAiService
import it.vstudioapps.stylestudio3d.domain.ai.PromptBuilder
import it.vstudioapps.stylestudio3d.domain.model.GenerationSource
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * Invia la foto e una descrizione testuale dello stile scelto all'abbonamento AI dell'utente.
 *
 * Il contratto esatto varia da provider a provider: qui si segue la forma pubblica delle API
 * OpenAI Images ("multipart/form-data" con campo `image`, `prompt`, `model`; risposta JSON
 * `{ "data": [ { "b64_json" | "url": ... } ] }`), usata anche da molti servizi compatibili.
 * Se l'abbonamento dell'utente espone un formato diverso, questo e' il punto da adattare
 * (vedi [creaRichiesta] e [estraiImmagine]) — non e' promesso funzionare con ogni provider
 * "out of the box".
 */
class RemoteHairMakeupAiService(
    private val credenziali: RemoteAiCredentials,
) : HairMakeupAiService {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun applicaStile(fotoBase: Bitmap, stile: StyleCatalogEntry): AiOutcome<Bitmap> =
        withContext(Dispatchers.IO) {
            try {
                verificaCredenziali(credenziali)?.let { return@withContext it }
                val richiesta = creaRichiesta(fotoBase, stile)

                AiHttpClient.instance.newCall(richiesta).execute().use { risposta ->
                    if (!risposta.isSuccessful) {
                        return@withContext AiOutcome.ErroreProvider(
                            "Il provider ha risposto con errore (${risposta.code}). Controlla API key e modello configurati."
                        )
                    }
                    val corpo = risposta.body?.string()
                        ?: return@withContext AiOutcome.ErroreProvider("Risposta vuota dal provider.")
                    estraiImmagine(corpo)
                }
            } catch (e: IOException) {
                AiOutcome.ErroreRete(e.message ?: "Connessione al provider AI non riuscita.")
            } catch (e: IllegalStateException) {
                AiOutcome.ErroreProvider(e.message ?: "Risposta del provider non valida.")
            }
        }

    private fun creaRichiesta(fotoBase: Bitmap, stile: StyleCatalogEntry): Request {
        val png = ByteArrayOutputStream().also { fotoBase.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
        val prompt = PromptBuilder.perStile(stile)
        val corpo = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("image", "foto.png", png.toRequestBody("image/png".toMediaType()))
            .addFormDataPart("prompt", prompt)
            .apply { if (credenziali.config.model.isNotBlank()) addFormDataPart("model", credenziali.config.model) }
            .build()

        return Request.Builder()
            .url(credenziali.endpointEditImmagine())
            .addHeader("Authorization", "Bearer ${credenziali.apiKey}")
            .post(corpo)
            .build()
    }

    private fun estraiImmagine(corpoJson: String): AiOutcome<Bitmap> {
        val risposta = try {
            json.decodeFromString(ImageEditResponse.serializer(), corpoJson)
        } catch (e: Exception) {
            throw IllegalStateException("Formato risposta inatteso dal provider AI.")
        }
        val voce = risposta.data.firstOrNull()
            ?: throw IllegalStateException("Il provider non ha restituito nessuna immagine.")

        val bytes = when {
            !voce.b64Json.isNullOrBlank() -> Base64.decode(voce.b64Json, Base64.DEFAULT)
            !voce.url.isNullOrBlank() -> scaricaBytes(voce.url)
            else -> throw IllegalStateException("Nessun contenuto immagine nella risposta del provider.")
        }
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: throw IllegalStateException("Impossibile decodificare l'immagine restituita dal provider.")
        return AiOutcome.Successo(bitmap, GenerationSource.ABBONAMENTO_AI)
    }

    private fun scaricaBytes(url: String): ByteArray {
        val richiesta = Request.Builder().url(url).get().build()
        AiHttpClient.instance.newCall(richiesta).execute().use { risposta ->
            val corpo = risposta.body ?: throw IllegalStateException("Download immagine fallito.")
            return corpo.bytes()
        }
    }

    @Serializable
    private data class ImageEditResponse(val data: List<ImageEditData> = emptyList())

    @Serializable
    private data class ImageEditData(
        @SerialName("b64_json") val b64Json: String? = null,
        val url: String? = null,
    )
}

/** Controllo comune usato anche da [RemoteVirtualTryOnService]: nessuna chiamata senza API key. */
internal fun verificaCredenziali(credenziali: RemoteAiCredentials): AiOutcome<Nothing>? =
    if (credenziali.apiKey.isBlank() || credenziali.config.baseUrl.isBlank()) AiOutcome.NonConfigurato else null
