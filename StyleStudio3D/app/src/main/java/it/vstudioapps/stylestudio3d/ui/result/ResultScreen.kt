package it.vstudioapps.stylestudio3d.ui.result

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import it.vstudioapps.stylestudio3d.domain.model.GenerationSource
import it.vstudioapps.stylestudio3d.drive.DriveSyncState
import it.vstudioapps.stylestudio3d.export.MetaAiExportHelper
import it.vstudioapps.stylestudio3d.ui.AppContainer
import it.vstudioapps.stylestudio3d.ui.session.StyleSessionViewModel
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun ResultScreen(appContainer: AppContainer, sessionViewModel: StyleSessionViewModel, onChiudi: () -> Unit) {
    val statoSessione by sessionViewModel.stato.collectAsState()
    val risultato = statoSessione.ultimoRisultato
    val statoDrive by appContainer.driveSyncService.stato.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(statoDrive) {
        val stato = statoDrive
        if (stato is DriveSyncState.Errore) snackbarHostState.showSnackbar(stato.messaggio)
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Il tuo scatto") }) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (risultato == null) {
                Text("Nessuno scatto ancora generato.", style = MaterialTheme.typography.bodyLarge)
            } else {
                Image(
                    painter = rememberAsyncImagePainter(risultato.imagePath),
                    contentDescription = "Scatto generato",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().weight(1f),
                )
                AssistChip(
                    onClick = {},
                    label = {
                        Text(
                            when (risultato.source) {
                                GenerationSource.ABBONAMENTO_AI -> "Generato dal tuo abbonamento AI"
                                GenerationSource.CHAT_ESTERNA -> "Importato da una chat AI esterna"
                                GenerationSource.ANTEPRIMA_LOCALE -> "Anteprima locale (nessun abbonamento AI collegato)"
                            },
                        )
                    },
                    modifier = Modifier.padding(vertical = 12.dp),
                )

                Button(
                    onClick = {
                        scope.launch { appContainer.driveSyncService.sincronizzaOra() }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = statoDrive !is DriveSyncState.Sincronizzazione,
                ) {
                    Icon(Icons.Filled.CloudUpload, contentDescription = null)
                    Text(
                        when (statoDrive) {
                            is DriveSyncState.Sincronizzazione -> "  Sincronizzazione in corso..."
                            is DriveSyncState.Connesso -> "  Sincronizza su Google Drive"
                            else -> "  Collega Google Drive dalle Impostazioni per sincronizzare"
                        },
                        modifier = Modifier.padding(start = 4.dp),
                    )
                }

                OutlinedButton(
                    onClick = { context.startActivity(MetaAiExportHelper.condividi(context, File(risultato.imagePath))) },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                ) {
                    Icon(Icons.Filled.Share, contentDescription = null)
                    Text("  Esporta verso Meta AI / social", modifier = Modifier.padding(start = 4.dp))
                }
            }

            Button(onClick = onChiudi, modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) {
                Text("Torna alla Home")
            }
        }
    }
}
