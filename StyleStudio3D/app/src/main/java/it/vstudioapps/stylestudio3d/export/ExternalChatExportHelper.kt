package it.vstudioapps.stylestudio3d.export

import android.content.Context
import android.content.Intent
import it.vstudioapps.stylestudio3d.util.ImageIo
import java.io.File

/**
 * Percorso "senza abbonamento": se l'utente non ha collegato nessuna API nelle Impostazioni,
 * l'app prepara comunque la foto e un prompt scritto pronto e apre la Sharesheet di Android
 * verso una chat AI esterna (es. ChatGPT, Gemini, ...) gia' installata sul telefono. L'utente
 * incolla/invia li' dentro, ottiene il risultato dalla chat e poi lo reimporta nell'app con
 * "Importa risultato da chat esterna" (vedi ui/hair/HairAndBeardScreen.kt e simili).
 *
 * Non c'e' un'API pubblica che permetta di automatizzare questo scambio: e' un ponte manuale,
 * dichiarato come tale in UI, non un'integrazione diretta con un servizio specifico.
 */
object ExternalChatExportHelper {

    /** Condivide una singola foto (capelli/barba/trucco) con il prompt come testo del messaggio. */
    fun condividiStile(context: Context, foto: File, prompt: String): Intent {
        val uri = ImageIo.uriCondivisibile(context, foto)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, prompt)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return Intent.createChooser(intent, "Genera con una chat AI esterna")
    }

    /** Condivide foto della persona + foto del capo (prova virtuale) insieme al prompt. */
    fun condividiTryOn(context: Context, fotoPersona: File, fotoCapo: File, prompt: String): Intent {
        val uriPersona = ImageIo.uriCondivisibile(context, fotoPersona)
        val uriCapo = ImageIo.uriCondivisibile(context, fotoCapo)
        val intent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = "image/*"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, arrayListOf(uriPersona, uriCapo))
            putExtra(Intent.EXTRA_TEXT, prompt)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return Intent.createChooser(intent, "Genera con una chat AI esterna")
    }
}
