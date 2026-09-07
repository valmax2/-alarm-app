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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import kotlinx.coroutines.launch

@Composable
fun OnboardingScreen(onKeySaved: (String) -> Unit) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var apiKeyInput by remember { mutableStateOf("") }
    var showKey by remember { mutableStateOf(false) }
    var isVerifying by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

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
            "Questa app clona la tua voce (o quella di chi te lo consente) usando ElevenLabs, " +
                "un servizio cloud specializzato: qualità professionale, ottimo supporto per l'italiano " +
                "con accento e intonazione naturali, non robotici.",
            style = MaterialTheme.typography.bodyMedium
        )
        Text(
            "Serve una tua chiave API ElevenLabs (gratuita per iniziare, poi a pagamento in base " +
                "all'uso). Non lascia mai questo telefono se non verso i server ElevenLabs, ed è salvata " +
                "cifrata sul dispositivo.",
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
                            container.apiKeyStore.setApiKey(key)
                            isVerifying = false
                            onKeySaved(key)
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
}
