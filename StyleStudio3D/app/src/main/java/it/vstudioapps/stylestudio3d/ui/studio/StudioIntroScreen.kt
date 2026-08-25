package it.vstudioapps.stylestudio3d.ui.studio

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.domain.model.BackgroundEnvironment
import it.vstudioapps.stylestudio3d.domain.model.LightingPreset
import it.vstudioapps.stylestudio3d.ui.render.StudioBackdropRenderer
import it.vstudioapps.stylestudio3d.ui.theme.BronzoCaldo

/**
 * Prima di entrare nei controlli veri e propri, una schermata che si presenta come un vero set
 * fotografico: si deve capire a colpo d'occhio dov'e' l'utente, non ritrovarsi subito davanti ai
 * controlli. Tocca "Entra nello studio" per passare a [PhotoStudioScreen].
 */
@Composable
fun StudioIntroScreen(onIndietro: () -> Unit, onEntra: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize()) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawIntoCanvas { canvas ->
                StudioBackdropRenderer.disegna(
                    canvas.nativeCanvas, size.width.toInt(), size.height.toInt(),
                    BackgroundEnvironment.STUDIO_GRIGIO, LightingPreset.DRAMMATICA,
                )
            }
        }

        IconButton(
            onClick = onIndietro,
            modifier = Modifier.statusBarsPadding().padding(8.dp),
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro", tint = Color.White)
        }

        Column(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Bottom,
        ) {
            Icon(Icons.Filled.PhotoCamera, contentDescription = null, tint = BronzoCaldo, modifier = Modifier.padding(bottom = 12.dp))
            Text(
                "Studio Fotografico",
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
            Text(
                "Scegli inquadratura, angolazione, luci e sfondo: sei tu il regista dello scatto finale.",
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp, bottom = 28.dp),
            )
            Button(
                onClick = onEntra,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = BronzoCaldo, contentColor = Color(0xFF241B2F)),
            ) {
                Text("Entra nello studio")
            }
        }
    }
}
