package it.vstudioapps.stylestudio3d.domain.ai

import android.graphics.Bitmap
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry

/**
 * Applica uno stile di capelli/barba/trucco a una foto. L'implementazione reale
 * ([it.vstudioapps.stylestudio3d.domain.ai.remote.RemoteHairMakeupAiService]) inoltra la richiesta
 * all'abbonamento AI dell'utente; [it.vstudioapps.stylestudio3d.domain.ai.mock.MockHairMakeupAiService]
 * produce un'anteprima locale quando nessun abbonamento e' configurato, cosi' il flusso resta
 * sempre provabile end-to-end.
 */
interface HairMakeupAiService {
    suspend fun applicaStile(fotoBase: Bitmap, stile: StyleCatalogEntry): AiOutcome<Bitmap>
}
