package it.vstudioapps.stylestudio3d.ui.render

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry

/**
 * Miniatura di una voce del catalogo: mostra l'immagine reale importata se presente, altrimenti
 * la miniatura procedurale di [StylePreviewRenderer]. Usata sia nelle griglie sia
 * nell'anteprima ingrandita a tocco lungo/hover (vedi ui/components/HoldToPreview.kt).
 */
@Composable
fun StylePreviewThumb(voce: StyleCatalogEntry, modifier: Modifier = Modifier) {
    val percorsoImportato = voce.importedPreviewPath
    if (percorsoImportato != null) {
        val bitmap = remember(percorsoImportato) { BitmapFactory.decodeFile(percorsoImportato) }
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = voce.name,
                modifier = modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
            return
        }
    }
    Canvas(modifier = modifier.fillMaxSize()) {
        drawIntoCanvas { canvas ->
            StylePreviewRenderer.disegna(canvas.nativeCanvas, size.width.toInt(), size.height.toInt(), voce.category, voce.attributes)
        }
    }
}
