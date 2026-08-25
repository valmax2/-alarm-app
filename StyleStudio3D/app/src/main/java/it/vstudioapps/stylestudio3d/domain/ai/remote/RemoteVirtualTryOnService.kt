package it.vstudioapps.stylestudio3d.domain.ai.remote

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import it.vstudioapps.stylestudio3d.domain.ai.AiOutcome
import it.vstudioapps.stylestudio3d.domain.ai.VirtualTryOnService
import it.vstudioapps.stylestudio3d.domain.model.GenerationSource
import it.vstudioapps.stylestudio3d.domain.model.WardrobeItem
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
import java.io.File
import java.io.IOException

/**
 * Prova virtuale reale: invia sia la foto dell'utente sia quella del capo all'abbonamento AI,
 * cosi' il provider puo' adattare il capo alla posa/corpo della persona (cosa che il composito
 * locale di [it.vstudioapps.stylestudio3d.domain.ai.mock.MockVirtualTryOnService] non fa).
 * Stesso avvertimento del servizio capelli/trucco/barba: il contratto segue le API OpenAI
 * Images come riferimento pubblico, da adattare se il provider dell'utente e' diverso.
 */
class RemoteVirtualTryOnService(
    private val credenziali: RemoteAiCredentials,
) : VirtualTryOnService {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun provaCapo(fotoUtente: Bitmap, capo: WardrobeItem): AiOutcome<Bitmap> =
        withContext(Dispatchers.IO) {
            try {
                verificaCredenziali(credenziali)?.let { return@withContext it }
                val fileCapo = File(capo.photoPath)
                if (!fileCapo.exists()) {
                    return@withContext AiOutcome.ErroreProvider("La foto del capo \"${capo.name}\" non e' piu' disponibile.")
                }

                val png = ByteArrayOutputStream().also { fotoUtente.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
                val prompt = "Vesti la persona nella prima immagine con il capo mostrato nella seconda immagine " +
                    "(categoria: ${capo.category.etichetta.lowercase()}, nome: \"${capo.name}\"). " +
                    "Adatta il capo a posa e proporzioni della persona, mantenendo viso e sfondo invariati."

                val corpo = MultipartBody.Builder().setType(MultipartBody.FORM)
                    .addFormDataPart("image", "persona.png", png.toRequestBody("image/png".toMediaType()))
                    .addFormDataPart("garment", fileCapo.name, fileCapo.asRequestBody())
                    .addFormDataPart("prompt", prompt)
                    .apply { if (credenziali.config.model.isNotBlank()) addFormDataPart("model", credenziali.config.model) }
                    .build()

                val richiesta = Request.Builder()
                    .url(credenziali.endpointEditImmagine())
                    .addHeader("Authorization", "Bearer ${credenziali.apiKey}")
                    .post(corpo)
                    .build()

                AiHttpClient.instance.newCall(richiesta).execute().use { risposta ->
                    if (!risposta.isSuccessful) {
                        return@withContext AiOutcome.ErroreProvider(
                            "Il provider ha risposto con errore (${risposta.code}). Controlla API key e modello configurati."
                        )
                    }
                    val corpoRisposta = risposta.body?.string()
                        ?: return@withContext AiOutcome.ErroreProvider("Risposta vuota dal provider.")
                    estraiImmagine(corpoRisposta)
                }
            } catch (e: IOException) {
                AiOutcome.ErroreRete(e.message ?: "Connessione al provider AI non riuscita.")
            } catch (e: IllegalStateException) {
                AiOutcome.ErroreProvider(e.message ?: "Risposta del provider non valida.")
            }
        }

    private fun estraiImmagine(corpoJson: String): AiOutcome<Bitmap> {
        val risposta = try {
            json.decodeFromString(TryOnResponse.serializer(), corpoJson)
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
        AiHttpClient.instance.newCall(Request.Builder().url(url).get().build()).execute().use { risposta ->
            val corpo = risposta.body ?: throw IllegalStateException("Download immagine fallito.")
            return corpo.bytes()
        }
    }

    private fun File.asRequestBody() = readBytes().toRequestBody("image/*".toMediaType())

    @Serializable
    private data class TryOnResponse(val data: List<TryOnData> = emptyList())

    @Serializable
    private data class TryOnData(
        @SerialName("b64_json") val b64Json: String? = null,
        val url: String? = null,
    )
}
