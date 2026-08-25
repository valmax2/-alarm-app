package it.vstudioapps.stylestudio3d.ui.render

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import it.vstudioapps.stylestudio3d.domain.model.CameraFraming
import it.vstudioapps.stylestudio3d.domain.model.LightingPreset
import it.vstudioapps.stylestudio3d.domain.model.StyleLength
import it.vstudioapps.stylestudio3d.domain.model.StyleVolume
import kotlin.math.cos
import kotlin.math.max

/**
 * Disegna il manichino "stile turntable": una silhouette procedurale a figura intera, non un
 * motore 3D poligonale. E' una scelta consapevole (vedi PRODUCT_SPEC.md) per avere sempre
 * un'anteprima coerente di capelli/barba/trucco/outfit senza dipendere da asset 3D con licenza
 * o da una pipeline di rendering pesante — con rotazione, luci e sfondo che rispondono davvero
 * alle scelte fatte in Studio Fotografico.
 *
 * Funziona su un [Canvas] Android "nudo" cosi' la stessa funzione serve sia per la preview live
 * in Compose (tramite `drawIntoCanvas`) sia per rasterizzare lo scatto finale su un Bitmap.
 */
object MannequinRenderer {

    fun disegna(canvas: Canvas, larghezzaPx: Int, altezzaPx: Int, parametri: MannequinParams) {
        val w = larghezzaPx.toFloat()
        val h = altezzaPx.toFloat()

        disegnaSfondo(canvas, w, h, parametri)

        canvas.save()
        applicaInquadratura(canvas, w, h, parametri.inquadratura)

        val centroX = w / 2f
        val scalaRotazione = max(0.45f, cos(Math.toRadians(parametri.rotazioneGradi.toDouble())).toFloat())
        canvas.save()
        canvas.scale(scalaRotazione, 1f, centroX, h)

        disegnaCorpo(canvas, w, h, centroX, parametri)
        canvas.restore()
        canvas.restore()

        applicaIlluminazione(canvas, w, h, parametri.illuminazione)
    }

    /**
     * Tinta di luce + vignettatura: pubblica cosi' [it.vstudioapps.stylestudio3d.ui.studio.StudioCompositor]
     * puo' applicare la stessa resa "fotografica" anche a una foto reale dell'utente, non solo al manichino.
     */
    fun applicaIlluminazione(canvas: Canvas, w: Float, h: Float, illuminazione: LightingPreset) {
        val tinta = coloreSicuro(illuminazione.tintaHex, Color.WHITE)
        val paintTinta = Paint().apply { color = tinta; alpha = 55 }
        canvas.drawRect(0f, 0f, w, h, paintTinta)

        // Vignettatura leggera: il fondale da studio (vedi StudioBackdropRenderer) ne applica gia' una sua,
        // qui basta un tocco in piu' per legare la tinta della luce scelta al resto dello scatto.
        val vignetta = Paint().apply {
            shader = RadialGradient(w / 2f, h / 2f, max(w, h) * 0.8f, Color.TRANSPARENT, Color.argb(35, 0, 0, 0), Shader.TileMode.CLAMP)
        }
        canvas.drawRect(0f, 0f, w, h, vignetta)
    }

    private fun disegnaSfondo(canvas: Canvas, w: Float, h: Float, parametri: MannequinParams) {
        StudioBackdropRenderer.disegna(canvas, w.toInt(), h.toInt(), parametri.sfondo, parametri.illuminazione)
    }

    private fun applicaInquadratura(canvas: Canvas, w: Float, h: Float, inquadratura: CameraFraming) {
        when (inquadratura) {
            CameraFraming.FIGURA_INTERA -> Unit
            CameraFraming.MEZZO_BUSTO -> {
                canvas.scale(1.8f, 1.8f, w / 2f, h * 0.30f)
            }
            CameraFraming.VISO -> {
                canvas.scale(3.6f, 3.6f, w / 2f, h * 0.16f)
            }
        }
    }

    private fun disegnaCorpo(canvas: Canvas, w: Float, h: Float, cx: Float, p: MannequinParams) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // Proporzioni su una figura alta quanto il canvas: testa ~12%, busto fino al 48%, gambe fino al 92%.
        val yTesta = h * 0.06f
        val raggioTesta = h * 0.055f
        val yCollo = yTesta + raggioTesta * 1.7f
        val ySpalle = yCollo + h * 0.015f
        val yVita = h * 0.46f
        val yCaviglia = h * 0.90f
        val yPiede = h * 0.94f
        val mezzaLarghezzaSpalle = w * 0.15f
        val mezzaLarghezzaVita = w * 0.10f
        val mezzaLarghezzaGambe = w * 0.045f

        // Ombra di contatto: ancora la figura al pavimento dello studio invece di sembrare "incollata".
        val paintOmbra = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(90, 0, 0, 0) }
        canvas.drawOval(RectF(cx - mezzaLarghezzaSpalle * 0.9f, yPiede + h * 0.005f, cx + mezzaLarghezzaSpalle * 0.9f, yPiede + h * 0.03f), paintOmbra)

        // Gambe (dietro al busto per profondita'), leggermente rastremate verso la caviglia.
        val coloreGambe = coloreSicuro(p.colorePantaloni ?: p.coloreAbito ?: p.colorePelle, Color.DKGRAY)
        listOf(-1f, 1f).forEach { lato ->
            val xGamba = cx + lato * mezzaLarghezzaVita * 0.55f
            val gamba = Path().apply {
                moveTo(xGamba - mezzaLarghezzaGambe * 1.15f, yVita)
                lineTo(xGamba + mezzaLarghezzaGambe * 1.15f, yVita)
                quadTo(xGamba + mezzaLarghezzaGambe * 1.05f, (yVita + yCaviglia) / 2f, xGamba + mezzaLarghezzaGambe * 0.8f, yCaviglia)
                lineTo(xGamba - mezzaLarghezzaGambe * 0.8f, yCaviglia)
                quadTo(xGamba - mezzaLarghezzaGambe * 1.05f, (yVita + yCaviglia) / 2f, xGamba - mezzaLarghezzaGambe * 1.15f, yVita)
                close()
            }
            paint.shader = LinearGradient(xGamba - mezzaLarghezzaGambe, 0f, xGamba + mezzaLarghezzaGambe, 0f, schiarisci(coloreGambe, 0.12f), scurisci(coloreGambe, 0.12f), Shader.TileMode.CLAMP)
            canvas.drawPath(gamba, paint)
            paint.shader = null
        }

        // Scarpe: sagoma ovale allungata invece di un blocco squadrato.
        paint.color = coloreSicuro(p.coloreScarpe, Color.BLACK)
        listOf(-1f, 1f).forEach { lato ->
            val xGamba = cx + lato * mezzaLarghezzaVita * 0.55f
            canvas.drawOval(
                RectF(xGamba - mezzaLarghezzaGambe * 1.35f, yCaviglia - h * 0.015f, xGamba + mezzaLarghezzaGambe * 1.35f, yPiede),
                paint,
            )
        }

        // Braccia (colore pelle: si assume manica corta salvo outerwear, semplificazione consapevole).
        val colorePelleSicuro = coloreSicuro(p.colorePelle, Color.parseColor("#D9A97A"))
        paint.color = colorePelleSicuro
        listOf(-1f, 1f).forEach { lato ->
            val xSpalla = cx + lato * mezzaLarghezzaSpalle * 0.9f
            val xMano = cx + lato * mezzaLarghezzaSpalle * 1.05f
            val braccio = Path().apply {
                moveTo(xSpalla, ySpalle)
                quadTo(xSpalla + lato * w * 0.01f, (ySpalle + yVita) / 2f, xMano, yVita + h * 0.05f)
            }
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = w * 0.045f
            paint.strokeCap = Paint.Cap.ROUND
            canvas.drawPath(braccio, paint)
            paint.style = Paint.Style.FILL
        }

        // Spalle arrotondate: due cerchi dietro al busto, cosi' l'attacco non sembra squadrato.
        paint.color = colorePelleSicuro
        listOf(-1f, 1f).forEach { lato -> canvas.drawCircle(cx + lato * mezzaLarghezzaSpalle * 0.92f, ySpalle, w * 0.028f, paint) }

        // Busto: abito se presente, altrimenti top; taper morbido verso la vita con curve invece di linee dritte.
        val yBaseBusto = if (p.coloreAbito != null) yCaviglia * 0.9f else yVita
        val busto = Path().apply {
            moveTo(cx - mezzaLarghezzaSpalle, ySpalle)
            lineTo(cx + mezzaLarghezzaSpalle, ySpalle)
            quadTo(cx + mezzaLarghezzaSpalle * 0.94f, (ySpalle + yBaseBusto) / 2f, cx + mezzaLarghezzaVita, yBaseBusto)
            lineTo(cx - mezzaLarghezzaVita, yBaseBusto)
            quadTo(cx - mezzaLarghezzaSpalle * 0.94f, (ySpalle + yBaseBusto) / 2f, cx - mezzaLarghezzaSpalle, ySpalle)
            close()
        }
        val coloreBusto = coloreSicuro(p.coloreAbito ?: p.coloreTop, Color.parseColor("#8A8A90"))
        paint.shader = LinearGradient(cx - mezzaLarghezzaSpalle, 0f, cx + mezzaLarghezzaSpalle, 0f, schiarisci(coloreBusto, 0.10f), scurisci(coloreBusto, 0.14f), Shader.TileMode.CLAMP)
        canvas.drawPath(busto, paint)
        paint.shader = null

        if (p.coloreOuterwear != null) {
            val giacca = Path().apply {
                moveTo(cx - mezzaLarghezzaSpalle * 1.12f, ySpalle - h * 0.01f)
                lineTo(cx + mezzaLarghezzaSpalle * 1.12f, ySpalle - h * 0.01f)
                quadTo(cx + mezzaLarghezzaVita * 1.15f, (ySpalle + yVita) / 2f, cx + mezzaLarghezzaVita * 1.12f, yVita * 0.95f)
                lineTo(cx, yVita * 1.02f)
                lineTo(cx - mezzaLarghezzaVita * 1.12f, yVita * 0.95f)
                quadTo(cx - mezzaLarghezzaVita * 1.15f, (ySpalle + yVita) / 2f, cx - mezzaLarghezzaSpalle * 1.12f, ySpalle - h * 0.01f)
                close()
            }
            val coloreOuter = coloreSicuro(p.coloreOuterwear, Color.DKGRAY)
            paint.shader = LinearGradient(cx - mezzaLarghezzaSpalle, 0f, cx + mezzaLarghezzaSpalle, 0f, schiarisci(coloreOuter, 0.08f), scurisci(coloreOuter, 0.16f), Shader.TileMode.CLAMP)
            paint.alpha = 235
            canvas.drawPath(giacca, paint)
            paint.shader = null
            paint.alpha = 255
        }

        // Collo + testa, con una leggera ombra sul lato per dare volume invece di un cerchio piatto.
        paint.color = colorePelleSicuro
        canvas.drawRect(cx - raggioTesta * 0.4f, yTesta + raggioTesta * 1.1f, cx + raggioTesta * 0.4f, yCollo + h * 0.01f, paint)
        val yCentroTesta = yTesta + raggioTesta
        paint.shader = RadialGradient(cx - raggioTesta * 0.35f, yCentroTesta - raggioTesta * 0.35f, raggioTesta * 1.6f, schiarisci(colorePelleSicuro, 0.15f), scurisci(colorePelleSicuro, 0.12f), Shader.TileMode.CLAMP)
        canvas.drawCircle(cx, yCentroTesta, raggioTesta, paint)
        paint.shader = null

        disegnaBarba(canvas, cx, yTesta, raggioTesta, p)
        disegnaCapelli(canvas, cx, yTesta, raggioTesta, p)
        disegnaTrucco(canvas, cx, yTesta, raggioTesta, p)
    }

    private fun disegnaCapelli(canvas: Canvas, cx: Float, yTesta: Float, raggioTesta: Float, p: MannequinParams) {
        val attributi = p.capelli ?: return
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = coloreSicuro(attributi.colorHex, Color.BLACK) }
        val estensioneVolume = when (attributi.volume) {
            StyleVolume.PIATTO -> 1.02f
            StyleVolume.NATURALE -> 1.15f
            StyleVolume.VOLUMINOSO -> 1.35f
            StyleVolume.SCOLPITO -> 1.20f
        }
        val estensioneLunghezza = when (attributi.length) {
            StyleLength.RASATO -> 0.02f
            StyleLength.CORTISSIMO -> 0.25f
            StyleLength.CORTO -> 0.5f
            StyleLength.MEDIO -> 0.9f
            StyleLength.LUNGO -> 1.6f
            StyleLength.EXTRA_LUNGO -> 2.3f
        }
        // Calotta superiore (sempre presente, anche sul rasato per leggibilita').
        canvas.drawArc(
            RectF(cx - raggioTesta * estensioneVolume, yTesta - raggioTesta * (estensioneVolume - 1f), cx + raggioTesta * estensioneVolume, yTesta + raggioTesta * 1.15f),
            180f, 180f, true, paint,
        )
        if (estensioneLunghezza > 0.3f) {
            // Lunghezza che scende oltre le spalle per stili medi/lunghi.
            val rect = RectF(
                cx - raggioTesta * estensioneVolume * 0.9f,
                yTesta,
                cx + raggioTesta * estensioneVolume * 0.9f,
                yTesta + raggioTesta * (1.4f + estensioneLunghezza),
            )
            canvas.drawRoundRect(rect, raggioTesta * 0.5f, raggioTesta * 0.5f, paint)
        }
    }

    private fun disegnaBarba(canvas: Canvas, cx: Float, yTesta: Float, raggioTesta: Float, p: MannequinParams) {
        val attributi = p.barba ?: return
        if (attributi.length == StyleLength.RASATO) return
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = coloreSicuro(attributi.colorHex, Color.DKGRAY)
            alpha = (100 + attributi.intensity.coerceIn(0f, 1f) * 155).toInt()
        }
        val estensione = when (attributi.length) {
            StyleLength.CORTISSIMO -> 0.35f
            StyleLength.CORTO -> 0.55f
            StyleLength.MEDIO -> 0.8f
            StyleLength.LUNGO, StyleLength.EXTRA_LUNGO -> 1.1f
            StyleLength.RASATO -> 0f
        }
        val rect = RectF(
            cx - raggioTesta * 0.85f,
            yTesta + raggioTesta * (0.55f),
            cx + raggioTesta * 0.85f,
            yTesta + raggioTesta * (1f + estensione),
        )
        canvas.drawRoundRect(rect, raggioTesta * 0.4f, raggioTesta * 0.4f, paint)
    }

    private fun disegnaTrucco(canvas: Canvas, cx: Float, yTesta: Float, raggioTesta: Float, p: MannequinParams) {
        val attributi = p.trucco ?: return
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = coloreSicuro(attributi.colorHex, Color.MAGENTA)
            alpha = (60 + attributi.intensity.coerceIn(0f, 1f) * 180).toInt()
        }
        // Occhi (due piccoli ovali) + labbra (un ovale piu' in basso): sufficiente a segnalare "trucco applicato".
        listOf(-1f, 1f).forEach { lato ->
            canvas.drawOval(
                RectF(
                    cx + lato * raggioTesta * 0.45f - raggioTesta * 0.16f, yTesta + raggioTesta * 0.85f,
                    cx + lato * raggioTesta * 0.45f + raggioTesta * 0.16f, yTesta + raggioTesta * 1.05f,
                ),
                paint,
            )
        }
        canvas.drawOval(
            RectF(cx - raggioTesta * 0.22f, yTesta + raggioTesta * 1.45f, cx + raggioTesta * 0.22f, yTesta + raggioTesta * 1.62f),
            paint,
        )
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
