package it.vstudioapps.runwarestudio.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import it.vstudioapps.runwarestudio.model.GenerationParams
import it.vstudioapps.runwarestudio.model.GenerationStatus
import it.vstudioapps.runwarestudio.ui.components.ModelPickerSheet
import it.vstudioapps.runwarestudio.ui.components.ReferenceImageStrip
import it.vstudioapps.runwarestudio.ui.components.ResultImageGrid
import it.vstudioapps.runwarestudio.ui.viewmodel.GenerationViewModel
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: GenerationViewModel,
    adultTermsAccepted: Boolean,
    onPickReferenceImages: () -> Unit,
    onExportFile: (File, String) -> Unit,
    onSaveToGallery: (File, String) -> Unit,
    onShareFile: (File) -> Unit,
    onOpenSettings: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var showModelPicker by remember { mutableStateOf(false) }
    var showAdvanced by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Runware Studio") },
            actions = {
                IconButton(onClick = onOpenSettings) {
                    Icon(Icons.Filled.Settings, contentDescription = "Impostazioni")
                }
            }
        )

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
        ) {
            OutlinedTextField(
                value = state.promptIt,
                onValueChange = viewModel::updatePromptIt,
                label = { Text("Descrivi l'immagine in italiano") },
                placeholder = { Text("Es: un ritratto fotorealistico di una donna con capelli rossi al tramonto") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default)
            )

            if (state.translatedPreview.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "Prompt inviato (EN): ${state.translatedPreview}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(Modifier.height(16.dp))

            AssistChip(
                onClick = { showModelPicker = true },
                label = { Text("Modello: ${state.selectedModel.displayName}") },
                leadingIcon = { Icon(Icons.Filled.AutoAwesome, contentDescription = null) }
            )

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Ottimizzazione automatica del prompt", style = MaterialTheme.typography.labelLarge)
                    Text(
                        if (state.autoOptimizeEnabled) {
                            "Adatta il prompt tradotto allo stile del modello scelto (tag di qualità, termini fotografici...)."
                        } else {
                            "Disattivata: invio esattamente la traduzione, senza aggiunte — controllo manuale totale."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = state.autoOptimizeEnabled,
                    onCheckedChange = viewModel::setAutoOptimizeEnabled
                )
            }

            Spacer(Modifier.height(16.dp))

            ReferenceImageStrip(
                images = state.referenceImages,
                onAdd = onPickReferenceImages,
                onRemove = viewModel::removeReferenceImage
            )

            if (state.referenceImages.isNotEmpty() && !state.selectedModel.supportsCharacterReference) {
                Spacer(Modifier.height(8.dp))
                Column {
                    Text(
                        "Forza del riferimento: ${"%.0f".format(state.params.referenceStrength * 100)}%",
                        style = MaterialTheme.typography.labelMedium
                    )
                    Slider(
                        value = state.params.referenceStrength,
                        onValueChange = { v -> viewModel.updateParams { it.copy(referenceStrength = v) } },
                        valueRange = 0.1f..1f
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            if (adultTermsAccepted) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Filtro contenuti (NSFW)", style = MaterialTheme.typography.labelLarge)
                        Text(
                            "Disattivalo solo per contenuti espliciti tra adulti consenzienti.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(
                        checked = !state.params.checkNsfw,
                        onCheckedChange = { disabled ->
                            viewModel.updateParams { it.copy(checkNsfw = !disabled) }
                        }
                    )
                }
                Spacer(Modifier.height(8.dp))
            }

            TextButton(onClick = { showAdvanced = !showAdvanced }) {
                Icon(Icons.Filled.Tune, contentDescription = null)
                Spacer(Modifier.width(4.dp))
                Text("Parametri avanzati")
                Icon(if (showAdvanced) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, contentDescription = null)
            }

            if (showAdvanced) {
                AdvancedParamsPanel(
                    params = state.params,
                    onChange = viewModel::updateParams
                )
            }

            Spacer(Modifier.height(20.dp))

            Button(
                onClick = viewModel::generate,
                enabled = !state.isBusy,
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (state.isBusy) {
                    CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                    Text(statusLabel(state.status))
                } else {
                    Icon(Icons.Filled.AutoAwesome, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Genera")
                }
            }

            state.errorMessage?.let { message ->
                Spacer(Modifier.height(12.dp))
                Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }

            if (state.resultPaths.isNotEmpty()) {
                Spacer(Modifier.height(20.dp))
                Text("Risultato", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                ResultImageGrid(
                    resultPaths = state.resultPaths,
                    onSave = { file -> onSaveToGallery(file, file.name) },
                    onExport = { file -> onExportFile(file, file.name) },
                    onShare = onShareFile
                )
            }

            Spacer(Modifier.height(32.dp))
        }
    }

    if (showModelPicker) {
        ModelPickerSheet(
            selectedModelId = state.selectedModel.id,
            onSelect = { preset ->
                viewModel.selectModel(preset)
                showModelPicker = false
            },
            onDismiss = { showModelPicker = false }
        )
    }
}

@Composable
private fun AdvancedParamsPanel(
    params: GenerationParams,
    onChange: ((GenerationParams) -> GenerationParams) -> Unit
) {
    Column(Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = params.negativePrompt,
            onValueChange = { v -> onChange { it.copy(negativePrompt = v) } },
            label = { Text("Prompt negativo (cosa evitare)") },
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            minLines = 2
        )

        LabeledSlider(
            label = "Passi (steps): ${params.steps}",
            value = params.steps.toFloat(),
            onValueChange = { v -> onChange { it.copy(steps = v.toInt()) } },
            valueRange = 1f..60f
        )
        LabeledSlider(
            label = "CFG Scale: ${"%.1f".format(params.cfgScale)}",
            value = params.cfgScale,
            onValueChange = { v -> onChange { it.copy(cfgScale = v) } },
            valueRange = 1f..15f
        )
        LabeledSlider(
            label = "Numero di immagini: ${params.numberResults}",
            value = params.numberResults.toFloat(),
            onValueChange = { v -> onChange { it.copy(numberResults = v.toInt()) } },
            valueRange = 1f..4f,
            steps = 2
        )

        Spacer(Modifier.height(8.dp))
        Text("Risoluzione", style = MaterialTheme.typography.labelLarge)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            GenerationParams.COMMON_RESOLUTIONS.forEach { (w, h) ->
                AssistChip(
                    onClick = { onChange { it.copy(width = w, height = h) } },
                    label = { Text("${w}x$h") }
                )
            }
        }

        Spacer(Modifier.height(8.dp))
        Text("Scheduler", style = MaterialTheme.typography.labelLarge)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            GenerationParams.SCHEDULERS.forEach { scheduler ->
                AssistChip(
                    onClick = { onChange { it.copy(scheduler = scheduler) } },
                    label = { Text(scheduler) }
                )
            }
        }

        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = params.seed?.toString().orEmpty(),
            onValueChange = { v -> onChange { it.copy(seed = v.toLongOrNull()) } },
            label = { Text("Seed (vuoto = casuale)") },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun LabeledSlider(
    label: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>,
    steps: Int = 0
) {
    Column(Modifier.padding(top = 8.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Slider(value = value, onValueChange = onValueChange, valueRange = valueRange, steps = steps)
    }
}

private fun statusLabel(status: GenerationStatus): String = when (status) {
    GenerationStatus.Translating -> "Traduzione…"
    GenerationStatus.UploadingReferences -> "Caricamento riferimenti…"
    GenerationStatus.Generating -> "Generazione…"
    else -> "Genera"
}
