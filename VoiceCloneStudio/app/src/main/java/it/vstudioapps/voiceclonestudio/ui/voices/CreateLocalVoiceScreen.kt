package it.vstudioapps.voiceclonestudio.ui.voices

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.LocalVoice
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import it.vstudioapps.voiceclonestudio.ui.common.copyUriToFile
import it.vstudioapps.voiceclonestudio.ui.common.rememberMicPermissionState
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

/** Come [CreateVoiceScreen], ma non carica nulla da nessuna parte: i campioni restano sul telefono. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateLocalVoiceScreen(
    modifier: Modifier = Modifier,
    onDone: () -> Unit,
    onCancel: () -> Unit
) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    val samples = remember { mutableStateListOf<File>() }
    var isRecording by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val samplesDir = remember { container.localVoiceRepository.samplesDir() }

    fun startRecording() {
        runCatching { container.audioRecorder.start(samplesDir) }
            .onSuccess { samples.add(it); isRecording = true }
            .onFailure { errorMessage = "Impossibile avviare la registrazione: microfono occupato?" }
    }

    fun stopRecording() {
        val recordedFile = container.audioRecorder.stop()
        if (recordedFile == null) samples.removeAll { !it.exists() }
        isRecording = false
    }

    val micPermission = rememberMicPermissionState(onGranted = { startRecording() })

    val pickFiles = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> ->
        uris.forEach { uri ->
            runCatching { copyUriToFile(context, uri, samplesDir) }
                .onSuccess { samples.add(it) }
                .onFailure { errorMessage = "Impossibile importare un file audio" }
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Nuova voce") },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Indietro")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Per una voce italiana naturale, non robotica", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "• Registra o carica campioni in italiano, con la tua vera intonazione.\n" +
                            "• Parla come faresti con una persona, con frasi intere e tono variato.\n" +
                            "• Ambiente silenzioso, senza musica o rumori di fondo.\n" +
                            "• Anche solo 10-20 secondi puliti bastano a XTTS-v2 per clonare il timbro; " +
                            "più campioni diversi aiutano comunque la fedeltà.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nome della voce") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    onClick = {
                        if (isRecording) {
                            stopRecording()
                        } else {
                            micPermission.withPermission { startRecording() }
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(if (isRecording) Icons.Filled.Stop else Icons.Filled.Mic, contentDescription = null)
                    Text(if (isRecording) " Ferma" else " Registra")
                }
                OutlinedButton(
                    onClick = { pickFiles.launch(arrayOf("audio/*")) },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Filled.UploadFile, contentDescription = null)
                    Text(" Importa file")
                }
            }

            if (samples.isNotEmpty()) {
                Text("Campioni (${samples.size})", style = MaterialTheme.typography.titleSmall)
                samples.forEachIndexed { index, file ->
                    Card {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(file.name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                            IconButton(onClick = {
                                file.delete()
                                samples.removeAt(index)
                            }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Rimuovi campione")
                            }
                        }
                    }
                }
            }

            errorMessage?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
            }

            Button(
                onClick = {
                    if (name.isBlank()) {
                        errorMessage = "Dai un nome alla voce"
                        return@Button
                    }
                    if (samples.isEmpty()) {
                        errorMessage = "Aggiungi almeno un campione audio"
                        return@Button
                    }
                    scope.launch {
                        container.localVoiceRepository.addVoice(
                            LocalVoice(
                                id = UUID.randomUUID().toString(),
                                name = name.trim(),
                                sampleFilePaths = samples.map { it.absolutePath },
                                createdAtEpochMillis = System.currentTimeMillis()
                            )
                        )
                        onDone()
                    }
                },
                enabled = !isRecording,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Salva voce")
            }
        }
    }
}
