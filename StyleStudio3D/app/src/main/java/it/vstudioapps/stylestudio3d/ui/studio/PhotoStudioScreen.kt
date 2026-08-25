package it.vstudioapps.stylestudio3d.ui.studio

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import it.vstudioapps.stylestudio3d.domain.model.BackgroundEnvironment
import it.vstudioapps.stylestudio3d.domain.model.CameraAngle
import it.vstudioapps.stylestudio3d.domain.model.CameraFraming
import it.vstudioapps.stylestudio3d.domain.model.LightingPreset
import it.vstudioapps.stylestudio3d.ui.components.LoadingOverlay
import it.vstudioapps.stylestudio3d.ui.render.MannequinCanvas
import it.vstudioapps.stylestudio3d.ui.session.OperazioneUiState
import it.vstudioapps.stylestudio3d.ui.session.StyleSessionViewModel

/**
 * L'utente fa il "regista": inquadratura, angolazione, luci e sfondo, poi genera lo scatto
 * finale. Se in sessione c'e' gia' una foto reale modificata (capelli/trucco/try-on), viene
 * quella la base dello scatto; altrimenti si usa il manichino procedurale.
 */
@Composable
fun PhotoStudioScreen(sessionViewModel: StyleSessionViewModel, onIndietro: () -> Unit, onScattoGenerato: () -> Unit) {
    val statoSessione by sessionViewModel.stato.collectAsState()
    val parametriManichino by sessionViewModel.mannequinParams.collectAsState()
    val operazione by sessionViewModel.operazione.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var generazioneAvviataQui by remember { mutableStateOf(false) }

    var spec by remember { mutableStateOf(statoSessione.studioSpec) }

    LaunchedEffect(operazione) {
        if (!generazioneAvviataQui) return@LaunchedEffect
        when (val stato = operazione) {
            is OperazioneUiState.Completata -> { generazioneAvviataQui = false; onScattoGenerato() }
            is OperazioneUiState.NonRiuscita -> { generazioneAvviataQui = false; snackbarHostState.showSnackbar(stato.messaggioUtente) }
            else -> Unit
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Studio Fotografico") },
                navigationIcon = { IconButton(onClick = onIndietro) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
        Column(modifier = Modifier.fillMaxSize()) {
            val fotoReale = statoSessione.fotoUtenteModificataPath
            if (fotoReale != null) {
                Image(
                    painter = rememberAsyncImagePainter(fotoReale),
                    contentDescription = "Anteprima",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(260.dp),
                )
            } else {
                MannequinCanvas(parametri = parametriManichino.copy(inquadratura = spec.framing), modifier = Modifier.fillMaxWidth().height(260.dp))
            }

            Column(modifier = Modifier.weight(1f).padding(horizontal = 16.dp).verticalScroll(rememberScrollState())) {
                SezioneRegia("Inquadratura", CameraFraming.entries, spec.framing, { it.etichetta }) { spec = spec.copy(framing = it) }
                SezioneRegia("Angolazione", CameraAngle.entries, spec.angle, { it.etichetta }) { spec = spec.copy(angle = it) }
                SezioneRegia("Luci", LightingPreset.entries, spec.lighting, { it.etichetta }) { spec = spec.copy(lighting = it) }
                SezioneRegia("Sfondo", BackgroundEnvironment.entries, spec.background, { it.etichetta }) { spec = spec.copy(background = it) }

                Button(
                    onClick = {
                        sessionViewModel.impostaStudioSpec(spec)
                        generazioneAvviataQui = true
                        sessionViewModel.generaScattoStudio()
                    },
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                ) { Text("Genera scatto") }
            }
        }

        if (operazione is OperazioneUiState.InCorso && generazioneAvviataQui) {
            LoadingOverlay(messaggio = "Preparo lo scatto...")
        }
        }
    }
}

@Composable
private fun <T> SezioneRegia(titolo: String, opzioni: List<T>, selezionato: T, etichetta: (T) -> String, onSelect: (T) -> Unit) {
    Text(titolo, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(opzioni) { opzione ->
            FilterChip(selected = opzione == selezionato, onClick = { onSelect(opzione) }, label = { Text(etichetta(opzione)) })
        }
    }
}
