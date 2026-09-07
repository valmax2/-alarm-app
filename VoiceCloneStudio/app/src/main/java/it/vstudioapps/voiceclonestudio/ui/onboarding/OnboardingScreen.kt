package it.vstudioapps.voiceclonestudio.ui.onboarding

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.Backend
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import kotlinx.coroutines.launch

/** [onConfigured] riceve il backend scelto e le credenziali che l'app dovrà usare da qui in poi (l'altra è null/vuota). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(onConfigured: (Backend, String?, String) -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()

    var backend by remember { mutableStateOf(Backend.SELF_HOSTED) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(
            Icons.Filled.RecordVoiceOver,
            contentDescription = null,
            modifier = Modifier.padding(top = 24.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Text("Benvenuto in VoiceClone Studio", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Clona la tua voce (o quella di chi te lo consente) e genera audio in italiano, " +
                "con accento e intonazione naturali. Scegli come vuoi generarla:",
            style = MaterialTheme.typography.bodyMedium
        )

        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = backend == Backend.SELF_HOSTED,
                onClick = { backend = Backend.SELF_HOSTED },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
            ) { Text("Gratis (PC)") }
            SegmentedButton(
                selected = backend == Backend.ELEVENLABS,
                onClick = { backend = Backend.ELEVENLABS },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
            ) { Text("ElevenLabs (a pagamento)") }
        }

        if (backend == Backend.SELF_HOSTED) {
            SelfHostedOnboarding(
                onConfigured = { url ->
                    scope.launch {
                        container.settingsRepository.setBackend(Backend.SELF_HOSTED)
                        container.settingsRepository.setServerUrl(url)
                        onConfigured(Backend.SELF_HOSTED, container.apiKeyStore.getApiKey(), url)
                    }
                }
            )
        } else {
            ElevenLabsOnboarding(
                onConfigured = { key ->
                    scope.launch {
                        container.settingsRepository.setBackend(Backend.ELEVENLABS)
                        container.apiKeyStore.setApiKey(key)
                        onConfigured(Backend.ELEVENLABS, key, "")
                    }
                }
            )
        }
    }
}

@Composable
private fun SelfHostedOnboarding(onConfigured: (String) -> Unit) {
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()

    var url by remember { mutableStateOf("") }
    var isVerifying by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Text(
        "Fa girare gratis sul tuo PC lo stesso motore di clonazione vocale open source (XTTS-v2) " +
            "che magari già usi, e l'app Android si collega ad esso sulla tua rete WiFi di casa — " +
            "nessuna chiave API, nessun costo. Serve installare ed avviare uno script sul PC: " +
            "istruzioni in VoiceCloneStudio/server/README.md nel repository. Nota: con questa " +
            "opzione la conversione voce→voce non è disponibile, solo testo→voce.",
        style = MaterialTheme.typography.bodyMedium
    )

    OutlinedTextField(
        value = url,
        onValueChange = { url = it; errorMessage = null },
        label = { Text("Indirizzo del server (es. http://192.168.1.23:8020)") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
        modifier = Modifier.fillMaxWidth()
    )

    errorMessage?.let {
        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
    }

    Button(
        onClick = {
            val trimmed = url.trim()
            if (trimmed.isBlank()) {
                errorMessage = "Inserisci l'indirizzo del server"
                return@Button
            }
            isVerifying = true
            errorMessage = null
            scope.launch {
                container.xttsServerApi.checkConnection(trimmed)
                    .onSuccess {
                        isVerifying = false
                        onConfigured(trimmed)
                    }
                    .onFailure {
                        isVerifying = false
                        errorMessage = (it.message ?: "Impossibile collegarsi al server") +
                            " — controlla che sia acceso e che il telefono sia sulla stessa rete WiFi."
                    }
            }
        },
        enabled = !isVerifying,
        modifier = Modifier.fillMaxWidth()
    ) {
        if (isVerifying) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp).padding(end = 8.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary
            )
        }
        Text(if (isVerifying) "Verifica in corso…" else "Verifica e continua")
    }
}

@Composable
private fun ElevenLabsOnboarding(onConfigured: (String) -> Unit) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var apiKeyInput by remember { mutableStateOf("") }
    var showKey by remember { mutableStateOf(false) }
    var isVerifying by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Text(
        "Servizio cloud specializzato: qualità professionale, ottimo supporto per l'italiano, " +
            "e anche la conversione voce→voce. Serve una tua chiave API (gratuita per iniziare, " +
            "ma la clonazione istantanea richiede un piano a pagamento). Non lascia mai questo " +
            "telefono se non verso i server ElevenLabs, ed è salvata cifrata sul dispositivo.",
        style = MaterialTheme.typography.bodyMedium
    )

    TextButton(onClick = {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://elevenlabs.io/app/settings/api-keys"))
        context.startActivity(intent)
    }) {
        Text("Apri elevenlabs.io per creare/copiare la tua chiave")
    }

    OutlinedTextField(
        value = apiKeyInput,
        onValueChange = { apiKeyInput = it; errorMessage = null },
        label = { Text("Chiave API ElevenLabs") },
        singleLine = true,
        visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        trailingIcon = {
            TextButton(onClick = { showKey = !showKey }) {
                Text(if (showKey) "Nascondi" else "Mostra")
            }
        },
        modifier = Modifier.fillMaxWidth()
    )

    errorMessage?.let {
        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
    }

    Button(
        onClick = {
            val key = apiKeyInput.trim()
            if (key.isBlank()) {
                errorMessage = "Inserisci una chiave API"
                return@Button
            }
            isVerifying = true
            errorMessage = null
            scope.launch {
                container.elevenLabsApi.validateApiKey(key)
                    .onSuccess {
                        isVerifying = false
                        onConfigured(key)
                    }
                    .onFailure {
                        isVerifying = false
                        errorMessage = it.message ?: "Impossibile verificare la chiave"
                    }
            }
        },
        enabled = !isVerifying,
        modifier = Modifier.fillMaxWidth()
    ) {
        if (isVerifying) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp).padding(end = 8.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary
            )
        }
        Text(if (isVerifying) "Verifica in corso…" else "Verifica e continua")
    }
}
