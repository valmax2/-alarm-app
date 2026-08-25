package it.vstudioapps.stylestudio3d.drive

import it.vstudioapps.stylestudio3d.domain.ai.remote.AiHttpClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/**
 * Chiamate dirette alle API REST v3 di Google Drive (https://developers.google.com/drive/api/v3),
 * autenticate con l'access token ottenuto da [GoogleDriveAuthorizationManager]. Nessun SDK Drive
 * pesante: bastano poche chiamate HTTP per cio' che serve qui (una cartella app + upload file).
 */
class DriveRestClient(private val accessToken: String) {

    private val json = Json { ignoreUnknownKeys = true }

    /** Cerca la cartella "Style Studio 3D" nel Drive dell'utente, creandola se non esiste. Ritorna il suo id. */
    suspend fun idCartellaApp(): Result<String> = runCatching {
        val query = "mimeType='application/vnd.google-apps.folder' and name='$NOME_CARTELLA' and trashed=false"
        val urlRicerca = "https://www.googleapis.com/drive/v3/files?q=${java.net.URLEncoder.encode(query, "UTF-8")}&fields=files(id,name)"
        val richiestaRicerca = Request.Builder().url(urlRicerca).addHeader("Authorization", "Bearer $accessToken").get().build()
        val esistente = AiHttpClient.instance.newCall(richiestaRicerca).execute().use { risposta ->
            if (!risposta.isSuccessful) throw IllegalStateException("Ricerca cartella Drive fallita (${risposta.code}).")
            json.decodeFromString(ListaFile.serializer(), risposta.body?.string().orEmpty()).files.firstOrNull()?.id
        }
        esistente ?: creaCartella()
    }

    private fun creaCartella(): String {
        val corpoJson = """{"name":"$NOME_CARTELLA","mimeType":"application/vnd.google-apps.folder"}"""
        val richiesta = Request.Builder()
            .url("https://www.googleapis.com/drive/v3/files")
            .addHeader("Authorization", "Bearer $accessToken")
            .post(corpoJson.toRequestBody("application/json".toMediaType()))
            .build()
        AiHttpClient.instance.newCall(richiesta).execute().use { risposta ->
            if (!risposta.isSuccessful) throw IllegalStateException("Creazione cartella Drive fallita (${risposta.code}).")
            return json.decodeFromString(FileDrive.serializer(), risposta.body?.string().orEmpty()).id
        }
    }

    suspend fun caricaFile(file: File, idCartella: String, mimeType: String): Result<String> = runCatching {
        val metadati = """{"name":"${file.name}","parents":["$idCartella"]}"""
        val corpo = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addPart(MultipartBody.Part.create(null, metadati, "application/json".toMediaType()))
            .addFormDataPart("file", file.name, file.readBytes().toRequestBody(mimeType.toMediaType()))
            .build()
        val richiesta = Request.Builder()
            .url("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
            .addHeader("Authorization", "Bearer $accessToken")
            .post(corpo)
            .build()
        AiHttpClient.instance.newCall(richiesta).execute().use { risposta ->
            if (!risposta.isSuccessful) throw IllegalStateException("Upload su Drive fallito per ${file.name} (${risposta.code}).")
            json.decodeFromString(FileDrive.serializer(), risposta.body?.string().orEmpty()).id
        }
    }

    @Serializable
    private data class ListaFile(val files: List<FileDrive> = emptyList())

    @Serializable
    private data class FileDrive(val id: String, val name: String = "")

    private companion object {
        const val NOME_CARTELLA = "Style Studio 3D"
    }
}
