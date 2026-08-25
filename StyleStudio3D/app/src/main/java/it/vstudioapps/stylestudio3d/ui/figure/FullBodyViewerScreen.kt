package it.vstudioapps.stylestudio3d.ui.figure

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.ui.render.MannequinCanvas
import it.vstudioapps.stylestudio3d.ui.session.StyleSessionViewModel

/**
 * Vista a figura intera: trascina orizzontalmente per ruotare il manichino (fronte/tre-quarti/
 * profilo) e vedere subito come stanno insieme capelli, barba, trucco e outfit scelti finora.
 */
@Composable
fun FullBodyViewerScreen(sessionViewModel: StyleSessionViewModel, onIndietro: () -> Unit, onProsegui: () -> Unit) {
    val parametriBase by sessionViewModel.mannequinParams.collectAsState()
    var rotazione by remember { mutableFloatStateOf(0f) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Figura intera") },
                navigationIcon = { IconButton(onClick = onIndietro) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro") } },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            MannequinCanvas(
                parametri = parametriBase.copy(rotazioneGradi = rotazione),
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .pointerInput(Unit) {
                        detectHorizontalDragGestures { _, dragAmount ->
                            rotazione = (rotazione + dragAmount * 0.25f).coerceIn(-80f, 80f)
                        }
                    },
            )
            Text(
                "Trascina per ruotare",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.fillMaxWidth().padding(8.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Button(onClick = onProsegui, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Vai allo Studio Fotografico")
            }
        }
    }
}
