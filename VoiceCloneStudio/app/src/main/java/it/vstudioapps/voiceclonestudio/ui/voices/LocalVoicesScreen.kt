package it.vstudioapps.voiceclonestudio.ui.voices

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.LocalVoice
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import kotlinx.coroutines.launch

/** Voci gestite in locale per il backend "server personale": niente da caricare da nessuna parte, solo nome + campioni salvati sul telefono. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocalVoicesScreen(
    modifier: Modifier = Modifier,
    onVoicesChanged: () -> Unit
) {
    var showCreate by remember { mutableStateOf(false) }

    if (showCreate) {
        CreateLocalVoiceScreen(
            modifier = modifier,
            onDone = {
                showCreate = false
                onVoicesChanged()
            },
            onCancel = { showCreate = false }
        )
        return
    }

    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    val voices by container.localVoiceRepository.voices.collectAsState(initial = emptyList())
    var voiceToDelete by remember { mutableStateOf<LocalVoice?>(null) }

    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text("Le tue voci") }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreate = true },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Nuova voce") }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (voices.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "Nessuna voce ancora. Tocca \"Nuova voce\" e registra o importa qualche " +
                            "campione audio: qui non c'è nulla da caricare da nessuna parte, resta " +
                            "tutto sul telefono finché non generi qualcosa.",
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(voices, key = { it.id }) { voice ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(voice.name, style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        "${voice.sampleFilePaths.size} campion${if (voice.sampleFilePaths.size == 1) "e" else "i"}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                IconButton(onClick = { voiceToDelete = voice }) {
                                    Icon(
                                        Icons.Filled.Delete,
                                        contentDescription = "Elimina ${voice.name}",
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    voiceToDelete?.let { voice ->
        AlertDialog(
            onDismissRequest = { voiceToDelete = null },
            title = { Text("Eliminare \"${voice.name}\"?") },
            text = { Text("I campioni audio salvati per questa voce verranno cancellati dal telefono.") },
            confirmButton = {
                TextButton(onClick = {
                    val target = voice
                    voiceToDelete = null
                    scope.launch {
                        container.localVoiceRepository.removeVoice(target.id)
                        onVoicesChanged()
                    }
                }) { Text("Elimina", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { voiceToDelete = null }) { Text("Annulla") }
            }
        )
    }
}
