package it.vstudioapps.voiceclonestudio.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.VoiceGenerationSettings
import kotlin.math.roundToInt

/**
 * Pannello con le slider fini di ElevenLabs (stabilità, somiglianza, stile, velocità,
 * potenziamento voce). Sono gli stessi parametri sia per il text-to-speech sia per la
 * conversione voce→voce — [showSpeed] è false per la conversione, che non supporta la velocità.
 */
@Composable
fun VoiceSettingsPanel(
    settings: VoiceGenerationSettings,
    onSettingsChanged: (VoiceGenerationSettings) -> Unit,
    modifier: Modifier = Modifier,
    showSpeed: Boolean = true
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Regolazioni fini", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = { onSettingsChanged(VoiceGenerationSettings.RECOMMENDED) }) {
                    Text("Ripristina consigliati")
                }
            }

            SettingSlider(
                label = "Stabilità",
                value = settings.stability,
                onValueChange = { onSettingsChanged(settings.copy(stability = it)) },
                help = "Bassa = più espressiva e naturale, ma meno prevedibile tra una generazione e l'altra. " +
                    "Alta = più costante, ma rischia di suonare piatta o robotica. Per l'italiano parlato, " +
                    "resta vicino a metà."
            )

            SettingSlider(
                label = "Somiglianza al timbro originale",
                value = settings.similarityBoost,
                onValueChange = { onSettingsChanged(settings.copy(similarityBoost = it)) },
                help = "Quanto il risultato deve aderire alla voce clonata. Alzala se il risultato non " +
                    "assomiglia abbastanza; se sentendo il risultato noti fruscii o artefatti, abbassala un po'."
            )

            SettingSlider(
                label = "Stile / espressività",
                value = settings.style,
                onValueChange = { onSettingsChanged(settings.copy(style = it)) },
                help = "Esagera l'intonazione e l'emotività presenti nei campioni originali. Valori alti " +
                    "possono introdurre un accento innaturale: tienilo basso per un parlato italiano pulito."
            )

            if (showSpeed) {
                SettingSlider(
                    label = "Velocità",
                    value = settings.speed,
                    onValueChange = { onSettingsChanged(settings.copy(speed = it)) },
                    valueRange = 0.7f..1.2f,
                    help = "Rallenta o accelera il parlato. 1.0 è il ritmo naturale della voce originale."
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Potenziamento voce", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "Migliora l'aderenza al timbro originale, con un piccolo aumento del tempo di generazione.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = settings.speakerBoost,
                    onCheckedChange = { onSettingsChanged(settings.copy(speakerBoost = it)) }
                )
            }
        }
    }
}

@Composable
private fun SettingSlider(
    label: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    help: String,
    valueRange: ClosedFloatingPointRange<Float> = 0f..1f
) {
    Column(modifier = Modifier.padding(vertical = 6.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(label, style = MaterialTheme.typography.bodyLarge)
            Text(
                "%.2f".format(value),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange,
            steps = (((valueRange.endInclusive - valueRange.start) / 0.01f).roundToInt() - 1).coerceAtLeast(0)
        )
        Text(help, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
