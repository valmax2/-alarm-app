package it.vstudioapps.faceguard.ui.screens

import androidx.compose.foundation.Image as BitmapImage
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import it.vstudioapps.faceguard.model.AppSettings
import it.vstudioapps.faceguard.model.CoverMode
import it.vstudioapps.faceguard.model.ThemeMode
import it.vstudioapps.faceguard.ui.components.CoverModeOption
import it.vstudioapps.faceguard.util.loadImageBitmap

@Composable
fun SettingsScreen(
    settings: AppSettings,
    onThemeModeChange: (ThemeMode) -> Unit,
    onCoverModeChange: (CoverMode) -> Unit,
    onThresholdChange: (Int) -> Unit,
    onPickCustomImage: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            SectionTitle("Aspetto")
            ThemeModeSelector(current = settings.themeMode, onChange = onThemeModeChange)
        }

        item {
            SectionTitle("Copertura schermo")
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                CoverModeOption(
                    icon = Icons.Filled.Image,
                    title = "Immagine personalizzata",
                    description = "Mostra un'immagine a tua scelta a schermo intero.",
                    selected = settings.coverMode == CoverMode.CUSTOM_IMAGE,
                    onSelect = { onCoverModeChange(CoverMode.CUSTOM_IMAGE) }
                )
                CoverModeOption(
                    icon = Icons.Filled.DarkMode,
                    title = "Schermo nero",
                    description = "Oscura completamente il display.",
                    selected = settings.coverMode == CoverMode.BLACK_SCREEN,
                    onSelect = { onCoverModeChange(CoverMode.BLACK_SCREEN) }
                )
                CoverModeOption(
                    icon = Icons.Filled.Lock,
                    title = "Blocco schermo",
                    description = "Blocca subito il dispositivo: serve lo sblocco di sicurezza per riprenderlo.",
                    selected = settings.coverMode == CoverMode.LOCK_SCREEN,
                    onSelect = { onCoverModeChange(CoverMode.LOCK_SCREEN) }
                )
            }
        }

        if (settings.coverMode == CoverMode.CUSTOM_IMAGE) {
            item {
                CustomImagePicker(imageUri = settings.customImageUri, onPickCustomImage = onPickCustomImage)
            }
        }

        item {
            SectionTitle("Tempo di assenza")
            ThresholdSlider(seconds = settings.absenceThresholdSeconds, onChange = onThresholdChange)
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text = text, style = MaterialTheme.typography.titleMedium)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ThemeModeSelector(current: ThemeMode, onChange: (ThemeMode) -> Unit) {
    val options = listOf(
        ThemeMode.LIGHT to "Chiaro",
        ThemeMode.DARK to "Scuro",
        ThemeMode.SYSTEM to "Sistema"
    )
    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        options.forEachIndexed { index, (mode, label) ->
            SegmentedButton(
                selected = current == mode,
                onClick = { onChange(mode) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size)
            ) {
                Text(label)
            }
        }
    }
}

@Composable
private fun CustomImagePicker(imageUri: String?, onPickCustomImage: () -> Unit) {
    val context = LocalContext.current
    var bitmap by remember(imageUri) { mutableStateOf<ImageBitmap?>(null) }

    LaunchedEffect(imageUri) {
        bitmap = imageUri?.let { loadImageBitmap(context, it) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val current = bitmap
        if (current != null) {
            BitmapImage(
                bitmap = current,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .clip(RoundedCornerShape(16.dp))
            )
        } else {
            Text(
                text = "Nessuna immagine selezionata: verrà mostrato schermo nero finché non ne scegli una.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
        OutlinedButton(onClick = onPickCustomImage, modifier = Modifier.fillMaxWidth()) {
            Icon(imageVector = Icons.Filled.Image, contentDescription = null)
            Text(text = if (current != null) "  Cambia immagine" else "  Scegli immagine")
        }
    }
}

@Composable
private fun ThresholdSlider(seconds: Int, onChange: (Int) -> Unit) {
    var currentValue by remember(seconds) { mutableIntStateOf(seconds) }
    var textFieldValue by remember(seconds) { mutableStateOf(seconds.toString()) }

    fun commit(newValue: Int) {
        val clamped = newValue.coerceIn(AppSettings.MIN_THRESHOLD_SECONDS, AppSettings.MAX_THRESHOLD_SECONDS)
        currentValue = clamped
        onChange(clamped)
    }

    Column {
        Text(
            text = "Attiva la copertura dopo $currentValue secondi di assenza",
            style = MaterialTheme.typography.bodyMedium
        )
        Text(
            text = "Trascina il cursore oppure scrivi il numero di secondi qui a fianco.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Slider(
                value = currentValue.toFloat(),
                onValueChange = { newFloat ->
                    currentValue = newFloat.toInt()
                    textFieldValue = currentValue.toString()
                },
                onValueChangeFinished = { onChange(currentValue) },
                valueRange = AppSettings.MIN_THRESHOLD_SECONDS.toFloat()..AppSettings.MAX_THRESHOLD_SECONDS.toFloat(),
                steps = AppSettings.MAX_THRESHOLD_SECONDS - AppSettings.MIN_THRESHOLD_SECONDS - 1,
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(12.dp))
            OutlinedTextField(
                value = textFieldValue,
                onValueChange = { typed ->
                    // Only digits, capped at 3 characters — plenty for a 0-60 range.
                    if (typed.length <= 3 && typed.all { it.isDigit() }) {
                        textFieldValue = typed
                        typed.toIntOrNull()?.let { commit(it) }
                    }
                },
                modifier = Modifier.width(84.dp),
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center),
                suffix = { Text("s") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { textFieldValue = currentValue.toString() })
            )
        }
    }
}
