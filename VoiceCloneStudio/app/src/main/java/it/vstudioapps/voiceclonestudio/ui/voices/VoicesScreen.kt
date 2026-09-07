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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.Backend
import it.vstudioapps.voiceclonestudio.data.ClonedVoice
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import kotlinx.coroutines.launch

/** Smista tra le voci cloud (ElevenLabs) e quelle locali (server personale), a seconda del backend attivo. */
@Composable
fun VoicesScreen(
    modifier: Modifier = Modifier,
    backend: Backend,
    refreshToken: Int,
    onVoicesChanged: () -> Unit,
    onTuneVoice: (ClonedVoice) -> Unit = {}
) {
    when (backend) {
        Backend.ELEVENLABS -> ElevenLabsVoicesScreen(modifier, refreshToken, onVoicesChanged, onTuneVoice)
        Backend.SELF_HOSTED -> LocalVoicesScreen(modifier, onVoicesChanged)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ElevenLabsVoicesScreen(
    modifier: Modifier = Modifier,
    refreshToken: Int,
    onVoicesChanged: () -> Unit,
    onTuneVoice: (ClonedVoice) -> Unit
) {
    var showCreate by remember { mutableStateOf(false) }

    if (showCreate) {
        CreateVoiceScreen(
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
    val apiKey = container.apiKeyStore.getApiKey().orEmpty()

    var voices by remember { mutableStateOf<List<ClonedVoice>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var voiceToDelete by remember { mutableStateOf<ClonedVoice?>(null) }

    fun reload() {
        isLoading = true
        errorMessage = null
        scope.launch {
            container.elevenLabsApi.listVoices(apiKey)
                .onSuccess { voices = it }
                .onFailure { errorMessage = it.message ?: "Errore nel caricamento delle voci" }
            isLoading = false
        }
    }

    LaunchedEffect(refreshToken) { reload() }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Le tue voci") },
                actions = {
                    IconButton(onClick = { reload() }) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Aggiorna")
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreate = true },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Nuova voce") }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                isLoading && voices.isEmpty() -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                errorMessage != null && voices.isEmpty() -> Column(
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(errorMessage!!, color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = { reload() }) { Text("Riprova") }
                }
                voices.isEmpty() -> Column(
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "Nessuna voce ancora. Tocca \"Nuova voce\" e carica qualche campione audio " +
                            "per clonare la tua voce (o quella di chi te lo consente).",
                        textAlign = TextAlign.Center
                    )
                }
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    // Il bottom più largo (96dp) lascia spazio al FAB "Nuova voce", che
                    // altrimenti galleggia sopra l'ultima card della lista e ne copre le
                    // icone di regolazione/eliminazione quando la lista arriva in fondo.
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        Text(
                            "Tocca l'icona di regolazione per aggiustare i parametri e provare " +
                                "una voce già clonata: non serve mai riclonarla per cambiarli.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    items(voices, key = { it.voiceId }) { voice ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(voice.name, style = MaterialTheme.typography.titleMedium)
                                    if (!voice.category.isNullOrBlank()) {
                                        Text(
                                            voice.category,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                Row {
                                    IconButton(onClick = { onTuneVoice(voice) }) {
                                        Icon(
                                            Icons.Filled.Tune,
                                            contentDescription = "Regola e prova ${voice.name}"
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
    }

    voiceToDelete?.let { voice ->
        AlertDialog(
            onDismissRequest = { voiceToDelete = null },
            title = { Text("Eliminare \"${voice.name}\"?") },
            text = { Text("La voce clonata verrà rimossa dal tuo account ElevenLabs. L'operazione non è reversibile.") },
            confirmButton = {
                TextButton(onClick = {
                    val target = voice
                    voiceToDelete = null
                    scope.launch {
                        container.elevenLabsApi.deleteVoice(apiKey, target.voiceId)
                            .onSuccess { reload(); onVoicesChanged() }
                            .onFailure { errorMessage = it.message ?: "Impossibile eliminare la voce" }
                    }
                }) { Text("Elimina", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { voiceToDelete = null }) { Text("Annulla") }
            }
        )
    }
}
