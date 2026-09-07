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
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import it.vstudioapps.voiceclonestudio.ui.conversion.VoiceConversionScreen
import it.vstudioapps.voiceclonestudio.ui.onboarding.OnboardingScreen
import it.vstudioapps.voiceclonestudio.ui.settings.SettingsScreen
import it.vstudioapps.voiceclonestudio.ui.tts.TextToSpeechScreen
import it.vstudioapps.voiceclonestudio.ui.voices.VoicesScreen

private enum class Tab(val label: String) {
    VOICES("Voci"),
    TTS("Testo → voce"),
    CONVERSION("Conversione"),
    SETTINGS("Impostazioni")
}

@Composable
fun AppRoot() {
    val container = LocalAppContainer.current
    var apiKey by remember { mutableStateOf(container.apiKeyStore.getApiKey()) }

    if (apiKey.isNullOrBlank()) {
        OnboardingScreen(onKeySaved = { savedKey -> apiKey = savedKey })
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
                refreshToken = refreshVoicesToken,
                onVoicesChanged = { refreshVoicesToken++ }
            )
            Tab.TTS -> TextToSpeechScreen(modifier = contentModifier, refreshToken = refreshVoicesToken)
            Tab.CONVERSION -> VoiceConversionScreen(modifier = contentModifier, refreshToken = refreshVoicesToken)
            Tab.SETTINGS -> SettingsScreen(
                modifier = contentModifier,
                onApiKeyCleared = { apiKey = null }
            )
        }
    }
}
