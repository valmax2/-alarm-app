package it.vstudioapps.stylestudio3d.domain.ai.mock

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import it.vstudioapps.stylestudio3d.domain.ai.AiOutcome
import it.vstudioapps.stylestudio3d.domain.ai.HairMakeupAiService
import it.vstudioapps.stylestudio3d.domain.model.GenerationSource
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry
import it.vstudioapps.stylestudio3d.domain.model.StyleCategory

/**
 * Implementazione locale, senza rete: colora la zona approssimativa (capelli/barba/trucco) della
 * foto con il colore e l'intensita' dello stile scelto. Non e' un editing fotorealistico — serve
 * a rendere il flusso completo provabile senza un abbonamento AI collegato. La UI deve sempre
 * segnalare che il risultato viene da [GenerationSource.ANTEPRIMA_LOCALE], mai spacciarlo per
 * l'output di un vero servizio IA.
 */
class MockHairMakeupAiService : HairMakeupAiService {

    override suspend fun applicaStile(fotoBase: Bitmap, stile: StyleCatalogEntry): AiOutcome<Bitmap> {
        val risultato = fotoBase.copy(Bitmap.Config.ARGB_8888, true) ?: fotoBase
        val canvas = Canvas(risultato)
        val w = risultato.width.toFloat()
        val h = risultato.height.toFloat()

        val colore = try {
            Color.parseColor(stile.attributes.colorHex)
        } catch (e: IllegalArgumentException) {
            Color.DKGRAY
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = colore
            alpha = (stile.attributes.intensity.coerceIn(0f, 1f) * 150).toInt().coerceIn(20, 200)
        }

        val regione = when (stile.category) {
            StyleCategory.CAPELLI -> RectF(0f, 0f, w, h * 0.34f)
            StyleCategory.BARBA -> RectF(w * 0.24f, h * 0.55f, w * 0.76f, h * 0.86f)
            StyleCategory.TRUCCO -> RectF(w * 0.16f, h * 0.36f, w * 0.84f, h * 0.60f)
        }
        canvas.drawRoundRect(regione, 28f, 28f, paint)
        return AiOutcome.Successo(risultato, GenerationSource.ANTEPRIMA_LOCALE)
    }
}
