package it.vstudioapps.runwarestudio.data.export

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The two ways a result image leaves the app's private archive: "Salva in Galleria" (straight
 * into the system Photos app via MediaStore) and "Esporta" (handed to whatever file
 * manager/cloud app the user picks through the system's ACTION_CREATE_DOCUMENT picker — the
 * actual picker launch lives in the composables via rememberLauncherForActivityResult, this
 * object only does the byte-copying once a destination uri exists).
 */
object ExportUtils {

    /** Copies [source]'s bytes into an already-obtained destination uri — typically the
     *  result of an ACTION_CREATE_DOCUMENT launcher. */
    suspend fun writeFileTo(context: Context, source: File, destination: Uri) =
        withContext(Dispatchers.IO) {
            context.contentResolver.openOutputStream(destination)?.use { out ->
                source.inputStream().use { input -> input.copyTo(out) }
            } ?: throw IOException("Impossibile scrivere nel percorso scelto")
        }

    /** Inserts [source] into the system Gallery under Pictures/RunwareStudio. On API 26-28
     *  (no scoped-storage MediaStore) this needs WRITE_EXTERNAL_STORAGE, requested by the
     *  caller before invoking this — see HomeScreen/JobDetailScreen's save button. */
    suspend fun saveToGallery(context: Context, source: File, displayName: String): Uri =
        withContext(Dispatchers.IO) {
            val resolver = context.contentResolver
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/RunwareStudio")
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                    ?: throw IOException("Impossibile creare il file nella Galleria")
                resolver.openOutputStream(uri)?.use { out ->
                    source.inputStream().use { it.copyTo(out) }
                } ?: throw IOException("Impossibile scrivere nella Galleria")
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
                uri
            } else {
                @Suppress("DEPRECATION")
                val dir = File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                    "RunwareStudio"
                ).apply { mkdirs() }
                val destFile = File(dir, displayName)
                source.copyTo(destFile, overwrite = true)
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    @Suppress("DEPRECATION")
                    put(MediaStore.Images.Media.DATA, destFile.absolutePath)
                }
                resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                    ?: Uri.fromFile(destFile)
            }
        }

    /** content:// uri (via the app's FileProvider) for sharing/opening one archive file with
     *  another app — the share sheet, or "apri con" from a file manager. */
    fun contentUriFor(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

    fun shareIntent(contentUri: Uri): Intent = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
}
