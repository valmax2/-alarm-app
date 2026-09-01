package it.vstudioapps.runwarestudio.data.archive

import android.content.Context
import android.net.Uri
import android.util.Base64
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Everything that touches image bytes on disk: downloading a Runware result URL into the
 * app's private archive, copying a picked reference photo in (so the archive survives the
 * original content:// uri being revoked), and base64-encoding a reference photo for upload.
 * Every job gets its own folder under filesDir/archive/<jobKey>, keyed by a UUID generated
 * before the job is even saved to Room — see ArchiveRepository.
 */
class ImageStorage(private val context: Context) {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun jobDir(jobKey: String): File =
        File(File(context.filesDir, "archive"), jobKey).apply { mkdirs() }

    suspend fun downloadResult(url: String, jobKey: String, index: Int): File =
        withContext(Dispatchers.IO) {
            val file = File(jobDir(jobKey), "result_$index.png")
            val request = Request.Builder().url(url).build()
            httpClient.newCall(request).execute().use { response ->
                val body = response.body
                if (!response.isSuccessful || body == null) {
                    throw IOException("Download immagine fallito: HTTP ${response.code}")
                }
                body.byteStream().use { input ->
                    file.outputStream().use { output -> input.copyTo(output) }
                }
            }
            file
        }

    suspend fun copyReferenceImage(uri: Uri, jobKey: String, index: Int): File =
        withContext(Dispatchers.IO) {
            val file = File(jobDir(jobKey), "reference_$index.jpg")
            context.contentResolver.openInputStream(uri)?.use { input ->
                file.outputStream().use { output -> input.copyTo(output) }
            } ?: throw IOException("Impossibile leggere l'immagine di riferimento")
            file
        }

    /** Base64 data URI Runware's imageUpload task expects, built straight from a picked uri —
     *  used before the job (and its archive folder) even exists. */
    suspend fun toDataUri(uri: Uri): String = withContext(Dispatchers.IO) {
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IOException("Impossibile leggere l'immagine di riferimento")
        val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        "data:$mime;base64,$base64"
    }

    fun deleteJobFiles(jobKey: String) {
        jobDir(jobKey).deleteRecursively()
    }

    /** Deletes a whole job's archive folder given any one file path that lives in it — used
     *  when removing an ArchiveJob, whose entity only stores absolute file paths, not the
     *  jobKey that named the folder at save time. */
    fun deleteContainingFolder(anyFilePathInJob: String) {
        File(anyFilePathInJob).parentFile?.deleteRecursively()
    }
}
