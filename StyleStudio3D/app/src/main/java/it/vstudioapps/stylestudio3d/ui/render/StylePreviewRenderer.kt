package it.vstudioapps.stylestudio3d.ui.render

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import it.vstudioapps.stylestudio3d.domain.model.StyleAttributes
import it.vstudioapps.stylestudio3d.domain.model.StyleCategory
import it.vstudioapps.stylestudio3d.domain.model.StyleLength
import it.vstudioapps.stylestudio3d.domain.model.StyleVolume

/**
 * Miniatura procedurale (viso + spalle stilizzati) per una voce del catalogo stili: usata quando
 * la voce non ha un'anteprima fotorealistica importata (vedi [StyleCatalogEntry.importedPreviewPath]).
 * Serve a distinguere visivamente ogni stile — anche quelli creati al volo dall'utente — senza
 * dipendere da immagini esterne.
 */
object StylePreviewRenderer {

    fun disegna(canvas: Canvas, larghezzaPx: Int, altezzaPx: Int, categoria: StyleCategory, attributi: StyleAttributes) {
        val w = larghezzaPx.toFloat()
        val h = altezzaPx.toFloat()
        val cx = w / 2f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        canvas.drawColor(Color.parseColor("#F1EBE3"))

        val raggioTesta = h * 0.26f
        val yTesta = h * 0.32f

        // Spalle.
        paint.color = Color.parseColor("#C7BEB2")
        canvas.drawRoundRect(RectF(cx - w * 0.32f, h * 0.72f, cx + w * 0.32f, h * 1.05f), 12f, 12f, paint)

        // Viso.
        paint.color = Color.parseColor("#D9A97A")
        canvas.drawCircle(cx, yTesta, raggioTesta, paint)

        when (categoria) {
            StyleCategory.CAPELLI -> disegnaCapelli(canvas, cx, yTesta, raggioTesta, attributi)
            StyleCategory.BARBA -> disegnaBarba(canvas, cx, yTesta, raggioTesta, attributi)
            StyleCategory.TRUCCO -> disegnaTrucco(canvas, cx, yTesta, raggioTesta, attributi)
        }
    }

    private fun disegnaCapelli(canvas: Canvas, cx: Float, yTesta: Float, r: Float, a: StyleAttributes) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = coloreSicuro(a.colorHex) }
        val volume = when (a.volume) {
            StyleVolume.PIATTO -> 1.0f
            StyleVolume.NATURALE -> 1.15f
            StyleVolume.VOLUMINOSO -> 1.4f
            StyleVolume.SCOLPITO -> 1.2f
        }
        canvas.drawArc(RectF(cx - r * volume, yTesta - r * volume, cx + r * volume, yTesta + r * 0.5f), 180f, 180f, true, paint)
        val lunghezza = when (a.length) {
            StyleLength.RASATO, StyleLength.CORTISSIMO -> return
            StyleLength.CORTO -> 0.4f
            StyleLength.MEDIO -> 0.8f
            StyleLength.LUNGO -> 1.3f
            StyleLength.EXTRA_LUNGO -> 1.8f
        }
        canvas.drawRoundRect(RectF(cx - r * volume * 0.85f, yTesta, cx + r * volume * 0.85f, yTesta + r * lunghezza), r * 0.3f, r * 0.3f, paint)
    }

    private fun disegnaBarba(canvas: Canvas, cx: Float, yTesta: Float, r: Float, a: StyleAttributes) {
        if (a.length == StyleLength.RASATO) {
            // "Rasato" per la barba = viso pulito: nessuna forma disegnata, il viso di base basta.
            return
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = coloreSicuro(a.colorHex)
            alpha = (110 + a.intensity.coerceIn(0f, 1f) * 145).toInt()
        }
        val estensione = when (a.length) {
            StyleLength.CORTISSIMO -> 0.35f
            StyleLength.CORTO -> 0.55f
            StyleLength.MEDIO -> 0.8f
            else -> 1.05f
        }
        canvas.drawRoundRect(RectF(cx - r * 0.85f, yTesta + r * 0.35f, cx + r * 0.85f, yTesta + r * (0.7f + estensione)), r * 0.3f, r * 0.3f, paint)
    }

    private fun disegnaTrucco(canvas: Canvas, cx: Float, yTesta: Float, r: Float, a: StyleAttributes) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = coloreSicuro(a.colorHex)
            alpha = (70 + a.intensity.coerceIn(0f, 1f) * 170).toInt()
        }
        listOf(-1f, 1f).forEach { lato ->
            canvas.drawOval(RectF(cx + lato * r * 0.42f - r * 0.16f, yTesta - r * 0.12f, cx + lato * r * 0.42f + r * 0.16f, yTesta + r * 0.1f), paint)
        }
        canvas.drawOval(RectF(cx - r * 0.24f, yTesta + r * 0.5f, cx + r * 0.24f, yTesta + r * 0.72f), paint)
    }

    private fun coloreSicuro(hex: String) = try { Color.parseColor(hex) } catch (e: IllegalArgumentException) { Color.GRAY }
}
