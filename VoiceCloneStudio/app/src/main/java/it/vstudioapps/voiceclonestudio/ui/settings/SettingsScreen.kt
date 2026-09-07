package it.vstudioapps.voiceclonestudio.ui.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.BuildConfig
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(modifier: Modifier = Modifier, onApiKeyCleared: () -> Unit) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val storedKey = container.apiKeyStore.getApiKey().orEmpty()
    val maskedKey = if (storedKey.length > 8) {
        "${storedKey.take(4)}••••••••${storedKey.takeLast(4)}"
    } else "••••••••"

    var statusMessage by remember { mutableStateOf<String?>(null) }
    var isChecking by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text("Impostazioni") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Chiave API ElevenLabs", style = MaterialTheme.typography.titleMedium)
                    Text(maskedKey, style = MaterialTheme.typography.bodyMedium)

                    statusMessage?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall)
                    }

                    OutlinedButton(
                        onClick = {
                            isChecking = true
                            statusMessage = null
                            scope.launch {
                                container.elevenLabsApi.validateApiKey(storedKey)
                                    .onSuccess { statusMessage = "Connessione OK — chiave valida." }
                                    .onFailure { statusMessage = it.message ?: "Verifica fallita" }
                                isChecking = false
                            }
                        },
                        enabled = !isChecking,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (isChecking) "Verifica in corso…" else "Verifica connessione")
                    }

                    TextButton(
                        onClick = {
                            container.apiKeyStore.clear()
                            onApiKeyCleared()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Rimuovi chiave / cambia account", color = MaterialTheme.colorScheme.error)
                    }
                }
            }

            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Usa la voce responsabilmente", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Clona solo voci per cui hai un consenso esplicito (la tua, o di chi te lo ha " +
                            "concesso). Clonare la voce di qualcuno senza permesso e usarla per ingannare " +
                            "o impersonare quella persona può essere illegale.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Card {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Dati e privacy", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "I campioni vocali e i testi che generi vengono inviati ai server di ElevenLabs " +
                            "per l'elaborazione. La chiave API è salvata cifrata solo su questo dispositivo. " +
                            "I clip generati restano nella memoria dell'app finché non li elimini.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://elevenlabs.io/privacy")))
                    }) {
                        Text("Privacy policy di ElevenLabs")
                    }
                }
            }

            Text(
                "VoiceClone Studio ${BuildConfig.VERSION_NAME} (build ${BuildConfig.GIT_SHA})",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
