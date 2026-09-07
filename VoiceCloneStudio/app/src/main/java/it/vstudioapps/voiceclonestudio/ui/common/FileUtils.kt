package it.vstudioapps.voiceclonestudio.ui.common

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File

/** Copia il contenuto di un content:// Uri (scelto con un file picker) in un file locale, sotto [destDir], provando a conservarne il nome originale. */
fun copyUriToFile(context: Context, uri: Uri, destDir: File): File {
    val name = queryDisplayName(context, uri) ?: "sample_${System.currentTimeMillis()}"
    val destFile = File(destDir, name)
    context.contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "Impossibile aprire il file selezionato" }
        destFile.outputStream().use { output -> input.copyTo(output) }
    }
    return destFile
}

private fun queryDisplayName(context: Context, uri: Uri): String? {
    return runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) cursor.getString(nameIndex) else null
        }
    }.getOrNull()
}
