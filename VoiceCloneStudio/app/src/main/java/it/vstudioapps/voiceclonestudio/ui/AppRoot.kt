package it.vstudioapps.voiceclonestudio.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import it.vstudioapps.voiceclonestudio.data.Backend
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import it.vstudioapps.voiceclonestudio.ui.conversion.VoiceConversionScreen
import it.vstudioapps.voiceclonestudio.ui.onboarding.OnboardingScreen
import it.vstudioapps.voiceclonestudio.ui.settings.SettingsScreen
import it.vstudioapps.voiceclonestudio.ui.tts.TextToSpeechScreen
import it.vstudioapps.voiceclonestudio.ui.voices.VoicesScreen
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private enum class Tab(val label: String) {
    VOICES("Voci"),
    TTS("Testo → voce"),
    CONVERSION("Conversione"),
    SETTINGS("Impostazioni")
}

@Composable
fun AppRoot() {
    val container = LocalAppContainer.current

    // Letture una tantum all'avvio (sincrone, dati piccoli e locali) per decidere subito se
    // mostrare l'onboarding — evitano lo sfarfallio di un frame vuoto in attesa del primo
    // valore dai Flow di DataStore.
    var backend by remember {
        mutableStateOf(runBlocking { container.settingsRepository.backend.first() })
    }
    var apiKey by remember { mutableStateOf(container.apiKeyStore.getApiKey()) }
    var serverUrl by remember {
        mutableStateOf(runBlocking { container.settingsRepository.serverUrl.first() })
    }

    val isConfigured = when (backend) {
        Backend.SELF_HOSTED -> serverUrl.isNotBlank()
        Backend.ELEVENLABS -> !apiKey.isNullOrBlank()
    }

    if (!isConfigured) {
        OnboardingScreen(
            onConfigured = { newBackend, newApiKey, newServerUrl ->
                backend = newBackend
                apiKey = newApiKey
                serverUrl = newServerUrl
            }
        )
        return
    }

    var selectedTab by remember { mutableStateOf(Tab.VOICES) }
    // La lista voci vive qui, condivisa tra la tab "Voci" (che la popola/modifica) e le tab
    // "Testo → voce"/"Conversione" (che la usano per il menu a tendina), così non serve
    // ricaricarla dal server ad ogni cambio tab.
    var refreshVoicesToken by remember { mutableStateOf(0) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == Tab.VOICES,
                    onClick = { selectedTab = Tab.VOICES },
                    icon = { Icon(Icons.Filled.RecordVoiceOver, contentDescription = null) },
                    label = { Text(Tab.VOICES.label) }
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.TTS,
                    onClick = { selectedTab = Tab.TTS },
                    icon = { Icon(Icons.Filled.GraphicEq, contentDescription = null) },
                    label = { Text(Tab.TTS.label) }
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.CONVERSION,
                    onClick = { selectedTab = Tab.CONVERSION },
                    icon = { Icon(Icons.Filled.SwapHoriz, contentDescription = null) },
                    label = { Text(Tab.CONVERSION.label) }
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.SETTINGS,
                    onClick = { selectedTab = Tab.SETTINGS },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                    label = { Text(Tab.SETTINGS.label) }
                )
            }
        }
    ) { padding ->
        val contentModifier = Modifier.padding(padding)
        when (selectedTab) {
            Tab.VOICES -> VoicesScreen(
                modifier = contentModifier,
                backend = backend,
                refreshToken = refreshVoicesToken,
                onVoicesChanged = { refreshVoicesToken++ }
            )
            Tab.TTS -> TextToSpeechScreen(modifier = contentModifier, backend = backend, refreshToken = refreshVoicesToken)
            Tab.CONVERSION -> VoiceConversionScreen(modifier = contentModifier, backend = backend, refreshToken = refreshVoicesToken)
            Tab.SETTINGS -> SettingsScreen(
                modifier = contentModifier,
                backend = backend,
                onBackendChanged = { backend = it },
                serverUrl = serverUrl,
                onServerUrlChanged = { serverUrl = it },
                onApiKeyCleared = { apiKey = null }
            )
        }
    }
}
