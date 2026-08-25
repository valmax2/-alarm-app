package it.vstudioapps.stylestudio3d.ui.render

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import it.vstudioapps.stylestudio3d.domain.model.BackgroundEnvironment
import it.vstudioapps.stylestudio3d.domain.model.LightingPreset
import kotlin.math.max

/**
 * Scenografia da studio fotografico vero: fondale a "carta senza soluzione di continuita'"
 * (la curva classica parete-pavimento), due softbox che illuminano da sopra, una fotocamera su
 * treppiede stilizzata in un angolo. Sostituisce il precedente sfondo a colore piatto dietro al
 * manichino/foto — deve capirsi a colpo d'occhio che quello e' uno studio, non uno sfondo generico.
 */
object StudioBackdropRenderer {

    fun disegna(canvas: Canvas, larghezzaPx: Int, altezzaPx: Int, sfondo: BackgroundEnvironment, illuminazione: LightingPreset) {
        val w = larghezzaPx.toFloat()
        val h = altezzaPx.toFloat()
        val coloreFondale = coloreSicuro(sfondo.colorHex, Color.LTGRAY)

        // Ambiente scuro attorno al set (da' profondita' e "senso di studio", indipendentemente dal tema dell'app).
        canvas.drawColor(Color.rgb(18, 16, 22))

        disegnaFondaleACarta(canvas, w, h, coloreFondale)
        disegnaSoftbox(canvas, w, h, illuminazione)
        disegnaFotocameraSuTreppiede(canvas, w, h)
        disegnaVignetta(canvas, w, h)
    }

    private fun disegnaFondaleACarta(canvas: Canvas, w: Float, h: Float, coloreFondale: Int) {
        val yCurva = h * 0.74f
        val percorso = Path().apply {
            moveTo(0f, 0f)
            lineTo(w, 0f)
            lineTo(w, yCurva)
            // La curva classica del fondale "seamless": la parete scende morbida verso il pavimento.
            quadTo(w * 0.5f, yCurva + h * 0.10f, 0f, yCurva)
            close()
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, 0f, 0f, yCurva + h * 0.10f, schiarisci(coloreFondale, 0.12f), scurisci(coloreFondale, 0.15f), Shader.TileMode.CLAMP)
        }
        canvas.drawPath(percorso, paint)

        // Pavimento oltre il fondale: riflesso morbido dello stesso colore.
        val paintPavimento = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, yCurva, 0f, h, scurisci(coloreFondale, 0.25f), Color.rgb(10, 9, 12), Shader.TileMode.CLAMP)
        }
        canvas.drawRect(0f, yCurva, w, h, paintPavimento)
    }

    private fun disegnaSoftbox(canvas: Canvas, w: Float, h: Float, illuminazione: LightingPreset) {
        val tinta = coloreSicuro(illuminazione.tintaHex, Color.WHITE)
        listOf(0.18f to 0.85f, 0.82f to 0.65f).forEach { (xFrazione, intensita) ->
            val paint = Paint().apply {
                shader = RadialGradient(
                    w * xFrazione, h * -0.05f, h * 0.5f,
                    Color.argb((150 * intensita).toInt(), Color.red(tinta), Color.green(tinta), Color.blue(tinta)),
                    Color.TRANSPARENT,
                    Shader.TileMode.CLAMP,
                )
            }
            canvas.drawRect(0f, 0f, w, h, paint)
        }
    }

    /** Piccola sagoma di una fotocamera su treppiede in basso a destra: rende leggibile "sei in uno studio foto". */
    private fun disegnaFotocameraSuTreppiede(canvas: Canvas, w: Float, h: Float) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(140, 0, 0, 0) }
        val baseX = w * 0.90f
        val baseY = h * 0.98f
        val altezzaTreppiede = h * 0.16f

        listOf(-1f, 0f, 1f).forEach { direzione ->
            canvas.drawLine(baseX, baseY - altezzaTreppiede, baseX + direzione * w * 0.05f, baseY, paint.also { it.strokeWidth = w * 0.006f })
        }
        val corpoY = baseY - altezzaTreppiede
        canvas.drawRoundRect(RectF(baseX - w * 0.045f, corpoY - h * 0.035f, baseX + w * 0.045f, corpoY + h * 0.01f), 10f, 10f, paint)
        canvas.drawCircle(baseX, corpoY - h * 0.012f, w * 0.028f, paint)
        paint.color = Color.argb(160, 40, 40, 40)
        canvas.drawCircle(baseX, corpoY - h * 0.012f, w * 0.016f, paint)
    }

    private fun disegnaVignetta(canvas: Canvas, w: Float, h: Float) {
        val paint = Paint().apply {
            shader = RadialGradient(w / 2f, h / 2f, max(w, h) * 0.8f, Color.TRANSPARENT, Color.argb(110, 0, 0, 0), Shader.TileMode.CLAMP)
        }
        canvas.drawRect(0f, 0f, w, h, paint)
    }

    private fun coloreSicuro(hex: String?, fallback: Int): Int {
        if (hex.isNullOrBlank()) return fallback
        return try { Color.parseColor(hex) } catch (e: IllegalArgumentException) { fallback }
    }

    private fun scurisci(colore: Int, fattore: Float): Int {
        val f = 1f - fattore.coerceIn(0f, 1f)
        return Color.rgb((Color.red(colore) * f).toInt(), (Color.green(colore) * f).toInt(), (Color.blue(colore) * f).toInt())
    }

    private fun schiarisci(colore: Int, fattore: Float): Int {
        val f = fattore.coerceIn(0f, 1f)
        fun verso(componente: Int) = (componente + (255 - componente) * f).toInt().coerceIn(0, 255)
        return Color.rgb(verso(Color.red(colore)), verso(Color.green(colore)), verso(Color.blue(colore)))
    }
}
