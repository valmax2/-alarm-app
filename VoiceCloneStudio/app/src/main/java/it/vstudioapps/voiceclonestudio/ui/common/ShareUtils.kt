package it.vstudioapps.voiceclonestudio.ui.common

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

/** Apre il foglio di condivisione di sistema per un clip audio generato. */
fun shareAudioFile(context: Context, file: File) {
    val uri = FileProvider.getUriForFile(context, "it.vstudioapps.voiceclonestudio.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "audio/*"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Condividi audio"))
}
