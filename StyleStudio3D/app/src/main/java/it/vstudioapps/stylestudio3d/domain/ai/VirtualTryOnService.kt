package it.vstudioapps.stylestudio3d.domain.ai

import android.graphics.Bitmap
import it.vstudioapps.stylestudio3d.domain.model.WardrobeItem

/** Prova virtuale di un capo/scarpa del guardaroba sulla foto caricata dall'utente. */
interface VirtualTryOnService {
    suspend fun provaCapo(fotoUtente: Bitmap, capo: WardrobeItem): AiOutcome<Bitmap>
}
