package it.vstudioapps.stylestudio3d.domain.ai.mock

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import it.vstudioapps.stylestudio3d.domain.ai.AiOutcome
import it.vstudioapps.stylestudio3d.domain.ai.VirtualTryOnService
import it.vstudioapps.stylestudio3d.domain.model.GarmentCategory
import it.vstudioapps.stylestudio3d.domain.model.GenerationSource
import it.vstudioapps.stylestudio3d.domain.model.WardrobeItem

/**
 * Sovrappone la foto del capo (caricata dall'utente nel guardaroba) sulla foto dell'utente, in
 * una zona plausibile in base alla categoria. E' un composito 2D, non un try-on fotorealistico
 * con adattamento a posa/corpo: quello richiede un vero servizio IA esterno (vedi
 * [it.vstudioapps.stylestudio3d.domain.ai.remote.RemoteVirtualTryOnService]).
 */
class MockVirtualTryOnService : VirtualTryOnService {

    override suspend fun provaCapo(fotoUtente: Bitmap, capo: WardrobeItem): AiOutcome<Bitmap> {
        val capoBitmap = BitmapFactory.decodeFile(capo.photoPath)
            ?: return AiOutcome.ErroreProvider("Non riesco a leggere la foto di \"${capo.name}\".")

        val risultato = fotoUtente.copy(Bitmap.Config.ARGB_8888, true) ?: fotoUtente
        val canvas = Canvas(risultato)
        val w = risultato.width.toFloat()
        val h = risultato.height.toFloat()

        val destinazione = when (capo.category) {
            GarmentCategory.TOP -> RectF(w * 0.20f, h * 0.28f, w * 0.80f, h * 0.62f)
            GarmentCategory.PANTALONI -> RectF(w * 0.22f, h * 0.55f, w * 0.78f, h * 0.95f)
            GarmentCategory.ABITO -> RectF(w * 0.18f, h * 0.28f, w * 0.82f, h * 0.95f)
            GarmentCategory.OUTERWEAR -> RectF(w * 0.12f, h * 0.24f, w * 0.88f, h * 0.68f)
            GarmentCategory.SCARPE -> RectF(w * 0.25f, h * 0.86f, w * 0.75f, h * 0.99f)
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { alpha = 215 }
        canvas.drawBitmap(capoBitmap, null, destinazione, paint)
        capoBitmap.recycle()
        return AiOutcome.Successo(risultato, GenerationSource.ANTEPRIMA_LOCALE)
    }
}
