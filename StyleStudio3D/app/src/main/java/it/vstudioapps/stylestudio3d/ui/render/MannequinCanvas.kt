package it.vstudioapps.stylestudio3d.ui.render

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas

/** Preview live del manichino in Compose: la stessa logica di [MannequinRenderer] disegna a schermo. */
@Composable
fun MannequinCanvas(parametri: MannequinParams, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        drawIntoCanvas { canvas ->
            MannequinRenderer.disegna(canvas.nativeCanvas, size.width.toInt(), size.height.toInt(), parametri)
        }
    }
}
