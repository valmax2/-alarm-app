package it.vstudioapps.voiceclonestudio.ui.conversion

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
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.ClipKind
import it.vstudioapps.voiceclonestudio.data.ClonedVoice
import it.vstudioapps.voiceclonestudio.data.GeneratedClip
import it.vstudioapps.voiceclonestudio.data.STS_MODEL_ID
import it.vstudioapps.voiceclonestudio.data.VoiceGenerationSettings
import it.vstudioapps.voiceclonestudio.ui.common.ClipHistoryList
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import it.vstudioapps.voiceclonestudio.ui.common.VoiceDropdown
import it.vstudioapps.voiceclonestudio.ui.common.VoiceSettingsPanel
import it.vstudioapps.voiceclonestudio.ui.common.rememberMicPermissionState
import it.vstudioapps.voiceclonestudio.ui.common.shareAudioFile
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

@Composable
fun VoiceConversionScreen(modifier: Modifier = Modifier, refreshToken: Int) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val apiKey = container.apiKeyStore.getApiKey().orEmpty()

    var voices by remember { mutableStateOf<List<ClonedVoice>>(emptyList()) }
    var selectedVoice by remember { mutableStateOf<ClonedVoice?>(null) }
    var sourceFile by remember { mutableStateOf<File?>(null) }
    var isRecording by remember { mutableStateOf(false) }
    var removeBackgroundNoise by remember { mutableStateOf(true) }
    var isConverting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val settings by container.settingsRepository.defaultSettings.collectAsState(initial = VoiceGenerationSettings.RECOMMENDED)
    val allClips by container.historyRepository.clips.collectAsState(initial = emptyList())
    val conversionClips = allClips.filter { it.kind == ClipKind.VOICE_CONVERSION }
    val playingPath by container.audioPlayer.playingPath.collectAsState()

    val sourcesDir = remember { File(context.cacheDir, "conversion_sources").apply { mkdirs() } }

    fun startRecording() {
        runCatching { container.audioRecorder.start(sourcesDir) }
            .onSuccess { sourceFile = it; isRecording = true }
            .onFailure { errorMessage = "Impossibile avviare la registrazione: microfono occupato?" }
    }

    fun stopRecording() {
        // Se la registrazione era troppo breve per produrre un file valido, stop() ritorna
        // null e cancella il file: aggiorniamo sourceFile di conseguenza.
        val recordedFile = container.audioRecorder.stop()
        if (recordedFile == null) sourceFile = null
        isRecording = false
    }

    val micPermission = rememberMicPermissionState(onGranted = { startRecording() })

    val pickFile = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let {
            runCatching { copyUriToFile(context, it, sourcesDir) }
                .onSuccess { sourceFile = it }
                .onFailure { errorMessage = "Impossibile importare il file audio" }
        }
    }

    LaunchedEffect(refreshToken) {
        container.elevenLabsApi.listVoices(apiKey).onSuccess { list ->
            voices = list
            if (selectedVoice == null) selectedVoice = list.firstOrNull()
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text("Conversione voce → voce") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Registra o importa un audio con un'altra voce (anche la tua, letta in modo diverso): " +
                    "l'app lo ridoppia mantenendo tempi e intonazione, ma con il timbro della voce clonata scelta.",
                style = MaterialTheme.typography.bodyMedium
            )

            if (voices.isEmpty()) {
                Text(
                    "Non hai ancora nessuna voce clonata. Vai nella tab \"Voci\" per crearne una.",
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                VoiceDropdown(
                    voices = voices,
                    selected = selectedVoice,
                    onSelected = { selectedVoice = it },
                    modifier = Modifier.fillMaxWidth()
                )
            }

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
                    onClick = { pickFile.launch(arrayOf("audio/*")) },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Filled.UploadFile, contentDescription = null)
                    Text(" Importa file")
                }
            }

            sourceFile?.let { file ->
                Card {
                    Text(
                        "Audio sorgente: ${file.name}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Rimuovi rumore di fondo", style = MaterialTheme.typography.bodyLarge)
                        Text(
                            "Ripulisce l'audio sorgente prima della conversione. Utile se registrato in un ambiente rumoroso.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(checked = removeBackgroundNoise, onCheckedChange = { removeBackgroundNoise = it })
                }
            }

            VoiceSettingsPanel(
                settings = settings,
                showSpeed = false,
                onSettingsChanged = { scope.launch { container.settingsRepository.setDefaultSettings(it) } }
            )

            errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Button(
                onClick = {
                    val voice = selectedVoice
                    val source = sourceFile
                    if (voice == null) {
                        errorMessage = "Seleziona una voce"
                        return@Button
                    }
                    if (source == null) {
                        errorMessage = "Registra o importa un audio sorgente"
                        return@Button
                    }
                    isConverting = true
                    errorMessage = null
                    val outputFile = File(container.historyRepository.clipsDir(), "conv_${System.currentTimeMillis()}.mp3")
                    scope.launch {
                        container.elevenLabsApi.speechToSpeech(
                            apiKey = apiKey,
                            voiceId = voice.voiceId,
                            sourceFile = source,
                            settings = settings,
                            removeBackgroundNoise = removeBackgroundNoise,
                            outputFile = outputFile
                        ).onSuccess { file ->
                            isConverting = false
                            container.historyRepository.addClip(
                                GeneratedClip(
                                    id = UUID.randomUUID().toString(),
                                    kind = ClipKind.VOICE_CONVERSION,
                                    voiceName = voice.name,
                                    sourceLabel = source.name,
                                    modelId = STS_MODEL_ID,
                                    settings = settings,
                                    filePath = file.absolutePath,
                                    createdAtEpochMillis = System.currentTimeMillis()
                                )
                            )
                            container.audioPlayer.play(file)
                        }.onFailure {
                            isConverting = false
                            errorMessage = it.message ?: "Impossibile convertire l'audio"
                        }
                    }
                },
                enabled = !isConverting && !isRecording && selectedVoice != null,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isConverting) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(end = 8.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Text("Converto…")
                } else {
                    Text("Converti")
                }
            }

            ClipHistoryList(
                clips = conversionClips,
                isPlaying = { playingPath == it.filePath },
                onTogglePlay = { clip ->
                    if (playingPath == clip.filePath) {
                        container.audioPlayer.stop()
                    } else {
                        container.audioPlayer.play(File(clip.filePath))
                    }
                },
                onShare = { shareAudioFile(context, File(it.filePath)) },
                onDelete = { clip -> scope.launch { container.historyRepository.removeClip(clip.id) } }
            )
        }
    }
}

private fun copyUriToFile(context: android.content.Context, uri: Uri, destDir: File): File {
    val name = runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
        }
    }.getOrNull() ?: "source_${System.currentTimeMillis()}"

    val destFile = File(destDir, name)
    context.contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "Impossibile aprire il file selezionato" }
        destFile.outputStream().use { output -> input.copyTo(output) }
    }
    return destFile
}
