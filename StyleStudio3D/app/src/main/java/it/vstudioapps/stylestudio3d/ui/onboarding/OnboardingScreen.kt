package it.vstudioapps.stylestudio3d.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.tts.NarratedGuide
import it.vstudioapps.stylestudio3d.tts.OnboardingScript

/**
 * Tutorial iniziale: testo scritto sempre visibile + narrazione vocale opzionale (la voce
 * "naturale" e' scelta da [NarratedGuide] tra quelle installate sul dispositivo). Un passo per
 * ogni categoria — l'utente puo' anche saltare la narrazione e leggere soltanto.
 */
@Composable
fun OnboardingScreen(guidaVocale: NarratedGuide, onCompletato: () -> Unit) {
    var indicePasso by remember { mutableIntStateOf(0) }
    var narrazioneAttiva by remember { mutableStateOf(true) }
    val ttsInRiproduzione by guidaVocale.inRiproduzione.collectAsState()
    val ttsPronto by guidaVocale.pronto.collectAsState()
    val passo = OnboardingScript.passi[indicePasso]

    // Aspetta che il motore TTS abbia finito l'inizializzazione asincrona prima di parlare,
    // altrimenti la prima chiamata a speak() puo' arrivare troppo presto e non produrre audio.
    LaunchedEffect(indicePasso, narrazioneAttiva, ttsPronto) {
        if (narrazioneAttiva && ttsPronto) guidaVocale.parla(passo.testo, idUtterance = "onboarding-$indicePasso")
    }
    DisposableEffect(Unit) {
        onDispose { guidaVocale.ferma() }
    }

    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp).verticalScroll(rememberScrollState()),
        ) {
            LinearProgressIndicator(
                progress = { (indicePasso + 1f) / OnboardingScript.passi.size },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(text = passo.titolo, style = MaterialTheme.typography.headlineSmall)
                IconButton(onClick = {
                    narrazioneAttiva = !narrazioneAttiva
                    if (!narrazioneAttiva) guidaVocale.ferma() else guidaVocale.parla(passo.testo, idUtterance = "onboarding-$indicePasso")
                }) {
                    Icon(
                        imageVector = if (narrazioneAttiva) Icons.Filled.VolumeUp else Icons.Filled.VolumeOff,
                        contentDescription = if (narrazioneAttiva) "Disattiva narrazione" else "Attiva narrazione",
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(text = passo.testo, style = MaterialTheme.typography.bodyLarge)
            if (ttsInRiproduzione) {
                Spacer(Modifier.height(12.dp))
                Text(text = "🔊 In lettura...", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
            }

            Spacer(Modifier.height(32.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (indicePasso > 0) {
                    OutlinedButton(onClick = { guidaVocale.ferma(); indicePasso-- }) { Text("Indietro") }
                }
                Button(onClick = {
                    guidaVocale.ferma()
                    if (indicePasso < OnboardingScript.passi.lastIndex) indicePasso++ else onCompletato()
                }) {
                    Text(if (indicePasso < OnboardingScript.passi.lastIndex) "Avanti" else "Inizia a usare l'app")
                }
            }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { guidaVocale.ferma(); onCompletato() }) { Text("Salta il tutorial") }
        }
    }
}
