package it.vstudioapps.stylestudio3d.export

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import it.vstudioapps.stylestudio3d.util.ImageIo
import java.io.File

/**
 * Esportazione dello scatto finale verso l'app Meta AI (o Instagram/WhatsApp/Facebook) per farlo
 * animare in un video.
 *
 * Limite onesto: Meta non pubblica un'API gratuita di terze parti per inviare un'immagine e
 * ricevere indietro un video animato via IA — l'unico modo reale per un utente e' aprire l'app
 * ufficiale e usare quella funzione manualmente. Questo helper fa la parte che un'app puo'
 * davvero fare: prepara il file e apre la Sharesheet di Android, cercando di puntarla
 * direttamente a un'app Meta se installata (altrimenti l'utente sceglie da solo).
 */
object MetaAiExportHelper {

    private val pacchettiMeta = listOf(
        "com.instagram.android",
        "com.facebook.katana",
        "com.whatsapp",
    )

    fun condividi(context: Context, immagine: File): Intent {
        val uri = ImageIo.uriCondivisibile(context, immagine)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val pacchettoInstallato = pacchettiMeta.firstOrNull { nomePacchetto ->
            try {
                context.packageManager.getPackageInfo(nomePacchetto, 0)
                true
            } catch (e: PackageManager.NameNotFoundException) {
                false
            }
        }
        // Se un'app Meta e' installata la apriamo direttamente (l'utente arriva subito alla sua
        // funzione di animazione/IA); altrimenti mostriamo la Sharesheet generica di Android,
        // che comunque elenca qualunque app Meta compatibile installata tra le opzioni.
        return if (pacchettoInstallato != null) {
            intent.setPackage(pacchettoInstallato)
        } else {
            Intent.createChooser(intent, "Esporta verso Meta AI / social")
        }
    }
}
