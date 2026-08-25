package it.vstudioapps.stylestudio3d.ui.render

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import it.vstudioapps.stylestudio3d.domain.model.CameraFraming
import it.vstudioapps.stylestudio3d.domain.model.LightingPreset
import it.vstudioapps.stylestudio3d.domain.model.StyleLength
import it.vstudioapps.stylestudio3d.domain.model.StyleVolume
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min

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

    /**
     * [immagineCorpoFrontale] e' un asset reale (illustrazione del corpo base, vedi
     * res/drawable-nodpi/mannequin_front.png) usato al posto della silhouette procedurale quando
     * la rotazione e' vicina al frontale — finche' non arrivano anche le viste a tre-quarti e di
     * profilo, oltre quell'angolo si ricade sul disegno procedurale.
     */
    fun disegna(canvas: Canvas, larghezzaPx: Int, altezzaPx: Int, parametri: MannequinParams, immagineCorpoFrontale: Bitmap? = null) {
        val w = larghezzaPx.toFloat()
        val h = altezzaPx.toFloat()

        disegnaSfondo(canvas, w, h, parametri)

        canvas.save()
        applicaInquadratura(canvas, w, h, parametri.inquadratura)

        val centroX = w / 2f
        val scalaRotazione = max(0.45f, cos(Math.toRadians(parametri.rotazioneGradi.toDouble())).toFloat())
        canvas.save()
        canvas.scale(scalaRotazione, 1f, centroX, h)

        if (immagineCorpoFrontale != null && kotlin.math.abs(parametri.rotazioneGradi) <= SOGLIA_GRADI_IMMAGINE_FRONTALE) {
            disegnaCorpoConImmagine(canvas, w, h, immagineCorpoFrontale, parametri)
        } else {
            disegnaCorpo(canvas, w, h, centroX, parametri)
        }
        canvas.restore()
        canvas.restore()

        applicaIlluminazione(canvas, w, h, parametri.illuminazione)
    }

    private const val SOGLIA_GRADI_IMMAGINE_FRONTALE = 25f

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

    /**
     * Corpo disegnato a partire dall'illustrazione reale invece delle forme geometriche. Le zone
     * di colore (capelli/barba/trucco/outfit) sono rettangoli approssimativi calibrati sulle
     * proporzioni misurate dell'immagine (vedi commit): non serve che coincidano pixel-per-pixel
     * col contorno del corpo perche' sono disegnati in blend "moltiplica" — dove il corpo e'
     * trasparente il colore non si vede, dove c'e' il corpo la sua ombreggiatura naturale resta
     * visibile sotto la tinta, invece di un blocco di colore piatto.
     */
    private fun disegnaCorpoConImmagine(canvas: Canvas, w: Float, h: Float, immagine: Bitmap, p: MannequinParams) {
        val bw = immagine.width.toFloat()
        val bh = immagine.height.toFloat()
        val scala = min(w / bw, h / bh)
        val disegnoW = bw * scala
        val disegnoH = bh * scala
        val offsetX = (w - disegnoW) / 2f
        val offsetY = (h - disegnoH) / 2f
        fun px(fx: Float) = offsetX + fx * disegnoW
        fun py(fy: Float) = offsetY + fy * disegnoH
        fun zona(fx0: Float, fy0: Float, fx1: Float, fy1: Float) = RectF(px(fx0), py(fy0), px(fx1), py(fy1))

        val paintOmbra = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(90, 0, 0, 0) }
        canvas.drawOval(zona(0.30f, 0.975f, 0.70f, 1.01f), paintOmbra)

        canvas.drawBitmap(immagine, null, RectF(offsetX, offsetY, offsetX + disegnoW, offsetY + disegnoH), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))

        val tinta = Paint(Paint.ANTI_ALIAS_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY) }
        fun coloraZona(rect: RectF, colore: Int) {
            tinta.color = colore
            canvas.drawRect(rect, tinta)
        }

        // Outfit: rettangoli larghi sulle zone del corpo, il blend "moltiplica" li ritaglia da solo alla silhouette.
        p.colorePantaloni?.let { coloraZona(zona(0.34f, 0.555f, 0.66f, 0.905f), coloreSicuro(it, Color.DKGRAY)) }
        (p.coloreAbito ?: p.coloreTop)?.let {
            val yFine = if (p.coloreAbito != null) 0.56f else 0.40f
            coloraZona(zona(0.30f, 0.17f, 0.70f, yFine), coloreSicuro(it, Color.GRAY))
        }
        p.coloreOuterwear?.let { coloraZona(zona(0.26f, 0.155f, 0.74f, 0.42f), coloreSicuro(it, Color.DKGRAY)) }
        p.coloreScarpe?.let { coloraZona(zona(0.36f, 0.905f, 0.64f, 0.985f), coloreSicuro(it, Color.BLACK)) }

        p.capelli?.let { attributi ->
            val estensione = when (attributi.length) {
                StyleLength.RASATO, StyleLength.CORTISSIMO -> 0.13f
                StyleLength.CORTO -> 0.20f
                StyleLength.MEDIO -> 0.32f
                StyleLength.LUNGO -> 0.48f
                StyleLength.EXTRA_LUNGO -> 0.60f
            }
            val largo = when (attributi.volume) {
                StyleVolume.PIATTO -> 0.30f
                StyleVolume.NATURALE -> 0.34f
                StyleVolume.VOLUMINOSO -> 0.40f
                StyleVolume.SCOLPITO -> 0.36f
            }
            coloraZona(zona(0.5f - largo / 2f, 0f, 0.5f + largo / 2f, estensione), coloreSicuro(attributi.colorHex, Color.BLACK))
        }
        p.barba?.let { attributi ->
            if (attributi.length != StyleLength.RASATO) {
                coloraZona(zona(0.38f, 0.11f, 0.62f, 0.165f), coloreSicuro(attributi.colorHex, Color.DKGRAY))
            }
        }
        p.trucco?.let { attributi ->
            val colore = coloreSicuro(attributi.colorHex, Color.MAGENTA)
            coloraZona(zona(0.41f, 0.072f, 0.47f, 0.09f), colore)
            coloraZona(zona(0.53f, 0.072f, 0.59f, 0.09f), colore)
            coloraZona(zona(0.46f, 0.113f, 0.54f, 0.128f), colore)
        }
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
