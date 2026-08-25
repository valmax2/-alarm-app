package it.vstudioapps.stylestudio3d.ui.render

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import it.vstudioapps.stylestudio3d.R

/** Preview live del manichino in Compose: la stessa logica di [MannequinRenderer] disegna a schermo. */
@Composable
fun MannequinCanvas(parametri: MannequinParams, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val immagineCorpo = remember { BitmapFactory.decodeResource(context.resources, R.drawable.mannequin_front) }
    Canvas(modifier = modifier) {
        drawIntoCanvas { canvas ->
            MannequinRenderer.disegna(canvas.nativeCanvas, size.width.toInt(), size.height.toInt(), parametri, immagineCorpo)
        }
    }
}
