package it.vstudioapps.runwarestudio.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import it.vstudioapps.runwarestudio.model.ArchiveJob
import it.vstudioapps.runwarestudio.ui.components.ResultImageGrid
import it.vstudioapps.runwarestudio.ui.viewmodel.ArchiveViewModel
import java.io.File
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobDetailScreen(
    jobId: Long,
    archiveViewModel: ArchiveViewModel,
    onBack: () -> Unit,
    onExportFile: (File, String) -> Unit,
    onSaveToGallery: (File, String) -> Unit,
    onShareFile: (File) -> Unit,
    onReuse: (ArchiveJob) -> Unit
) {
    var job by remember { mutableStateOf<ArchiveJob?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(jobId) {
        archiveViewModel.jobFlow(jobId).collect {
            job = it
            loaded = true
        }
    }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Dettaglio") },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Indietro")
                }
            },
            actions = {
                if (job != null) {
                    IconButton(onClick = { showDeleteConfirm = true }) {
                        Icon(Icons.Filled.Delete, contentDescription = "Elimina")
                    }
                }
            }
        )

        val current = job
        when {
            current == null && loaded -> {
                Text(
                    "Lavoro non trovato (potrebbe essere stato eliminato).",
                    modifier = Modifier.padding(16.dp)
                )
            }
            current != null -> {
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp)
                ) {
                    Text("Prompt (italiano)", style = MaterialTheme.typography.labelLarge)
                    Text(current.promptIt, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(10.dp))
                    Text("Prompt (inglese, inviato a Runware)", style = MaterialTheme.typography.labelLarge)
                    Text(current.promptEn, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "${current.modelDisplayName} · ${current.params.width}x${current.params.height} · " +
                            "${current.params.steps} step · CFG ${current.params.cfgScale} · " +
                            DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
                                .format(Date(current.createdAt)),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { onReuse(current) }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Filled.Replay, contentDescription = null)
                        Spacer(Modifier.height(0.dp))
                        Text("  Riusa questi parametri")
                    }

                    Spacer(Modifier.height(20.dp))
                    Text(
                        "Risultati",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(8.dp))
                    ResultImageGrid(
                        resultPaths = current.resultImagePaths,
                        onSave = { file -> onSaveToGallery(file, file.name) },
                        onExport = { file -> onExportFile(file, file.name) },
                        onShare = onShareFile
                    )
                }
            }
        }
    }

    if (showDeleteConfirm) {
        val toDelete = job
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Eliminare questo lavoro?") },
            text = { Text("Le immagini generate e le foto di riferimento salvate verranno rimosse dall'archivio.") },
            confirmButton = {
                TextButton(onClick = {
                    toDelete?.let { archiveViewModel.deleteJob(it) }
                    showDeleteConfirm = false
                    onBack()
                }) { Text("Elimina") }
            },
            dismissButton = {
                OutlinedButton(onClick = { showDeleteConfirm = false }) { Text("Annulla") }
            }
        )
    }
}
