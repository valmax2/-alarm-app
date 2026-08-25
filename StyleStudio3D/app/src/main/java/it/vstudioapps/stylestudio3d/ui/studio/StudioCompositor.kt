package it.vstudioapps.stylestudio3d.ui.studio

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import it.vstudioapps.stylestudio3d.domain.model.CameraFraming
import it.vstudioapps.stylestudio3d.domain.model.PhotoStudioSpec
import it.vstudioapps.stylestudio3d.ui.render.MannequinRenderer

/**
 * Mette in scena una foto reale dell'utente (gia' modificata da capelli/barba/trucco/try-on)
 * dentro lo Studio Fotografico: la incornicia secondo [PhotoStudioSpec.framing], la posa sullo
 * sfondo scelto e applica la stessa resa luce/vignettatura del manichino procedurale, cosi' il
 * risultato finale e' coerente sia che l'utente abbia caricato una foto sia che stia solo
 * sfogliando gli stili senza foto.
 */
object StudioCompositor {

    fun componi(fotoUtente: Bitmap, spec: PhotoStudioSpec): Bitmap {
        val larghezza = 1080
        val altezza = 1440
        val risultato = Bitmap.createBitmap(larghezza, altezza, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(risultato)

        canvas.drawColor(coloreSicuro(spec.background.colorHex))

        val sorgente = rettaglioPerInquadratura(fotoUtente, spec.framing)
        val destinazione = Rect(0, 0, larghezza, altezza)
        canvas.drawBitmap(fotoUtente, sorgente, destinazione, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))

        MannequinRenderer.applicaIlluminazione(canvas, larghezza.toFloat(), altezza.toFloat(), spec.lighting)
        return risultato
    }

    private fun rettaglioPerInquadratura(bitmap: Bitmap, framing: CameraFraming): Rect {
        val w = bitmap.width
        val h = bitmap.height
        return when (framing) {
            CameraFraming.FIGURA_INTERA -> Rect(0, 0, w, h)
            CameraFraming.MEZZO_BUSTO -> Rect(0, 0, w, (h * 0.6f).toInt().coerceAtLeast(1))
            CameraFraming.VISO -> Rect((w * 0.2f).toInt(), 0, (w * 0.8f).toInt().coerceAtLeast(1), (h * 0.35f).toInt().coerceAtLeast(1))
        }
    }

    private fun coloreSicuro(hex: String) = try { Color.parseColor(hex) } catch (e: IllegalArgumentException) { Color.LTGRAY }
}
