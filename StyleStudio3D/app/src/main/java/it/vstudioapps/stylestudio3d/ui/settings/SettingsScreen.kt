package it.vstudioapps.stylestudio3d.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Alignment
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.BuildConfig
import it.vstudioapps.stylestudio3d.domain.model.AiProviderPreset
import it.vstudioapps.stylestudio3d.drive.DriveSyncState
import it.vstudioapps.stylestudio3d.ui.AppContainer
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(appContainer: AppContainer, onIndietro: () -> Unit, onRivediTutorial: () -> Unit) {
    val preferenze by appContainer.preferenzeUtente.preferenze.collectAsState(initial = null)
    val statoDrive by appContainer.driveSyncService.stato.collectAsState()
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var preset by remember { mutableStateOf(AiProviderPreset.OPENAI_COMPATIBLE) }
    var baseUrl by remember { mutableStateOf("") }
    var model by remember { mutableStateOf("") }
    var apiKey by remember { mutableStateOf("") }
    var inizializzatoDaPreferenze by remember { mutableStateOf(false) }

    LaunchedEffect(preferenze) {
        val p = preferenze ?: return@LaunchedEffect
        if (!inizializzatoDaPreferenze) {
            preset = p.aiPreset
            baseUrl = p.aiBaseUrl
            model = p.aiModel
            inizializzatoDaPreferenze = true
        }
    }

    val launcherAutorizzazioneDrive = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { risultato ->
        appContainer.driveSyncService.completaAutorizzazione(risultato)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Impostazioni") },
                navigationIcon = { IconButton(onClick = onIndietro) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp).verticalScroll(rememberScrollState())) {
            Text("Abbonamento IA", style = MaterialTheme.typography.titleLarge)
            Text(
                "Collega qui il tuo abbonamento IA gia' esistente: la API key resta cifrata sul dispositivo, non lascia mai l'app se non verso l'indirizzo che indichi qui sotto.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )
            Column(Modifier.padding(bottom = 8.dp)) {
                AiProviderPreset.entries.forEach { opzione ->
                    FilterChip(
                        selected = preset == opzione,
                        onClick = { preset = opzione },
                        label = { Text(opzione.etichetta) },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    )
                }
            }
            OutlinedTextField(
                value = baseUrl, onValueChange = { baseUrl = it },
                label = { Text("URL base del provider") },
                placeholder = { Text("https://api.tuoprovider.com/v1") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                singleLine = true,
            )
            OutlinedTextField(
                value = model, onValueChange = { model = it },
                label = { Text("Modello (facoltativo)") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                singleLine = true,
            )
            OutlinedTextField(
                value = apiKey, onValueChange = { apiKey = it },
                label = { Text(if (preferenze?.hasApiKeyConfigured == true) "API key (gia' configurata, lascia vuoto per non cambiarla)" else "API key") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                singleLine = true,
            )
            Button(
                onClick = {
                    scope.launch {
                        if (apiKey.isNotBlank()) appContainer.credenzialiSicure.salvaAiApiKey(apiKey)
                        val haChiave = apiKey.isNotBlank() || (preferenze?.hasApiKeyConfigured ?: false)
                        appContainer.preferenzeUtente.salvaConfigurazioneAi(preset, baseUrl, model, haChiave)
                        apiKey = ""
                        snackbarHostState.showSnackbar("Configurazione salvata.")
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            ) { Text("Salva abbonamento IA") }

            HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp))

            Text("Google Drive", style = MaterialTheme.typography.titleLarge)
            Text(
                "Sincronizza guardaroba e creazioni con Google Drive. Richiede di rifare l'accesso a ogni riavvio dell'app (limite del prototipo).",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )
            when (val s = statoDrive) {
                is DriveSyncState.Connesso -> {
                    Text("Account collegato.", style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(onClick = { appContainer.driveSyncService.disconnetti() }, modifier = Modifier.padding(top = 8.dp)) { Text("Disconnetti") }
                }
                is DriveSyncState.Errore -> {
                    Text("Errore: ${s.messaggio}", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                    Button(onClick = { scope.launch { appContainer.driveSyncService.connetti { launcherAutorizzazioneDrive.launch(it) } } }, modifier = Modifier.padding(top = 8.dp)) {
                        Text("Riprova a collegare Google Drive")
                    }
                }
                else -> {
                    Button(onClick = { scope.launch { appContainer.driveSyncService.connetti { launcherAutorizzazioneDrive.launch(it) } } }) {
                        Text("Collega Google Drive")
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp))

            Text("Tutorial", style = MaterialTheme.typography.titleLarge)
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                Text("Narrazione vocale attiva", modifier = Modifier.weight(1f, fill = false).padding(end = 12.dp))
                Switch(
                    checked = preferenze?.narrazioneAttiva ?: true,
                    onCheckedChange = { attiva -> scope.launch { appContainer.preferenzeUtente.setNarrazioneAttiva(attiva) } },
                )
            }
            OutlinedButton(onClick = onRivediTutorial, modifier = Modifier.padding(top = 12.dp)) { Text("Rivedi il tutorial") }

            HorizontalDivider(modifier = Modifier.padding(vertical = 24.dp))
            Text(
                "Style Studio 3D — build ${BuildConfig.VERSION_NAME} (${BuildConfig.GIT_SHA})",
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}
