package it.vstudioapps.runwarestudio.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import it.vstudioapps.runwarestudio.BuildConfig
import it.vstudioapps.runwarestudio.model.ThemeMode
import it.vstudioapps.runwarestudio.ui.viewmodel.ConnectionTestState
import it.vstudioapps.runwarestudio.ui.viewmodel.SettingsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel) {
    val settings by viewModel.settings.collectAsState()
    val apiKeyPresent by viewModel.apiKeyPresent.collectAsState()
    val connectionTest by viewModel.connectionTest.collectAsState()
    val archiveCleared by viewModel.archiveCleared.collectAsState()

    val segmindKeyPresent by viewModel.segmindKeyPresent.collectAsState()

    var apiKeyField by remember { mutableStateOf(viewModel.currentApiKey().orEmpty()) }
    var keyVisible by remember { mutableStateOf(false) }
    var segmindKeyField by remember { mutableStateOf(viewModel.currentSegmindApiKey().orEmpty()) }
    var segmindKeyVisible by remember { mutableStateOf(false) }
    var showAdultTermsDialog by remember { mutableStateOf(false) }
    var showClearArchiveDialog by remember { mutableStateOf(false) }

    LaunchedEffect(archiveCleared) {
        if (archiveCleared) viewModel.consumeArchiveClearedEvent()
    }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Impostazioni") })

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Text("API Runware", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "Serve una tua API key gratuita da my.runware.ai — non viene mai condivisa, resta cifrata solo su questo dispositivo.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = apiKeyField,
                onValueChange = { apiKeyField = it },
                label = { Text("API key") },
                singleLine = true,
                visualTransformation = if (keyVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { keyVisible = !keyVisible }) {
                        Icon(
                            if (keyVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = "Mostra/nascondi"
                        )
                    }
                },
                keyboardOptions = KeyboardOptions.Default,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { viewModel.setApiKey(apiKeyField) }, enabled = apiKeyField.isNotBlank()) {
                    Text("Salva")
                }
                OutlinedButton(onClick = { viewModel.testConnection() }, enabled = apiKeyPresent) {
                    Text("Testa connessione")
                }
            }
            Spacer(Modifier.height(6.dp))
            ConnectionTestStatus(connectionTest)

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("API Segmind (opzionale)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "Serve solo per \"Scambia volto\" in Genera — sostituisce il volto nell'immagine già " +
                    "generata con quello della foto di riferimento, funziona anche con Pony. Prendi una " +
                    "chiave a consumo su segmind.com. Senza questa chiave il resto dell'app funziona lo stesso.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = segmindKeyField,
                onValueChange = { segmindKeyField = it },
                label = { Text("API key Segmind") },
                singleLine = true,
                visualTransformation = if (segmindKeyVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { segmindKeyVisible = !segmindKeyVisible }) {
                        Icon(
                            if (segmindKeyVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = "Mostra/nascondi"
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { viewModel.setSegmindApiKey(segmindKeyField) },
                    enabled = segmindKeyField.isNotBlank()
                ) { Text("Salva") }
                if (segmindKeyPresent) {
                    OutlinedButton(onClick = { viewModel.clearSegmindApiKey(); segmindKeyField = "" }) {
                        Text("Rimuovi")
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("Contenuti per adulti", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        if (settings.adultTermsAccepted) {
                            "Attivi: puoi disattivare il filtro NSFW in Genera per contenuti espliciti tra adulti consenzienti."
                        } else {
                            "Disattivi: il filtro NSFW resta sempre attivo in Genera."
                        },
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Switch(
                    checked = settings.adultTermsAccepted,
                    onCheckedChange = { enabling ->
                        if (enabling) showAdultTermsDialog = true else viewModel.setAdultTermsAccepted(false)
                    }
                )
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("Aspetto", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                ThemeMode.entries.forEach { mode ->
                    FilterChip(
                        selected = settings.themeMode == mode,
                        onClick = { viewModel.setThemeMode(mode) },
                        label = { Text(themeModeLabel(mode)) }
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("Archivio", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { showClearArchiveDialog = true }) {
                Text("Svuota archivio")
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))
            Text(
                "Runware Studio · build ${BuildConfig.GIT_SHA}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(32.dp))
        }
    }

    if (showAdultTermsDialog) {
        AdultTermsDialog(
            onConfirm = {
                viewModel.setAdultTermsAccepted(true)
                showAdultTermsDialog = false
            },
            onDismiss = { showAdultTermsDialog = false }
        )
    }

    if (showClearArchiveDialog) {
        AlertDialog(
            onDismissRequest = { showClearArchiveDialog = false },
            title = { Text("Svuotare l'archivio?") },
            text = { Text("Tutte le generazioni salvate e le relative immagini verranno eliminate definitivamente.") },
            confirmButton = {
                TextButton(onClick = { viewModel.clearArchive(); showClearArchiveDialog = false }) {
                    Text("Svuota")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showClearArchiveDialog = false }) { Text("Annulla") }
            }
        )
    }
}

@Composable
private fun ConnectionTestStatus(state: ConnectionTestState) {
    when (state) {
        is ConnectionTestState.Testing -> Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(modifier = Modifier.height(16.dp), strokeWidth = 2.dp)
            Spacer(Modifier.height(0.dp))
            Text("  Verifica in corso…", style = MaterialTheme.typography.bodySmall)
        }
        is ConnectionTestState.Success -> Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text("  Connessione riuscita", style = MaterialTheme.typography.bodySmall)
        }
        is ConnectionTestState.Failure -> Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Error, contentDescription = null, tint = MaterialTheme.colorScheme.error)
            Text("  ${state.message}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
        ConnectionTestState.Idle -> {}
    }
}

@Composable
private fun AdultTermsDialog(onConfirm: () -> Unit, onDismiss: () -> Unit) {
    var checked by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Contenuti per adulti") },
        text = {
            Column {
                Text(
                    "Disattivando il filtro NSFW potrai generare contenuti espliciti. Confermi " +
                        "che li userai solo per soggetti adulti e consenzienti, e mai per contenuti " +
                        "che coinvolgono minori in nessuna forma?"
                )
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = checked, onCheckedChange = { checked = it })
                    Text("Confermo", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = checked) { Text("Conferma") }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) { Text("Annulla") }
        }
    )
}

private fun themeModeLabel(mode: ThemeMode): String = when (mode) {
    ThemeMode.LIGHT -> "Chiaro"
    ThemeMode.DARK -> "Scuro"
    ThemeMode.SYSTEM -> "Sistema"
}
