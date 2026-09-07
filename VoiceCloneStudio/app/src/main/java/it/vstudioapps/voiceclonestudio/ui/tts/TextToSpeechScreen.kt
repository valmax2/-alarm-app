package it.vstudioapps.voiceclonestudio.ui.tts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.Backend
import it.vstudioapps.voiceclonestudio.data.ClipKind
import it.vstudioapps.voiceclonestudio.data.ClonedVoice
import it.vstudioapps.voiceclonestudio.data.GeneratedClip
import it.vstudioapps.voiceclonestudio.data.LocalVoice
import it.vstudioapps.voiceclonestudio.data.SelfHostedGenerationSettings
import it.vstudioapps.voiceclonestudio.data.TTS_MODELS
import it.vstudioapps.voiceclonestudio.data.VoiceGenerationSettings
import it.vstudioapps.voiceclonestudio.ui.common.ClipHistoryList
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import it.vstudioapps.voiceclonestudio.ui.common.LocalVoiceDropdown
import it.vstudioapps.voiceclonestudio.ui.common.MicDictationButton
import it.vstudioapps.voiceclonestudio.ui.common.ModelDropdown
import it.vstudioapps.voiceclonestudio.ui.common.VoiceDropdown
import it.vstudioapps.voiceclonestudio.ui.common.VoiceSettingsPanel
import it.vstudioapps.voiceclonestudio.ui.common.shareAudioFile
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

/** Smista tra la generazione cloud (ElevenLabs) e quella sul server personale, a seconda del backend attivo. */
@Composable
fun TextToSpeechScreen(modifier: Modifier = Modifier, backend: Backend, refreshToken: Int) {
    when (backend) {
        Backend.ELEVENLABS -> ElevenLabsTextToSpeechScreen(modifier, refreshToken)
        Backend.SELF_HOSTED -> SelfHostedTextToSpeechScreen(modifier)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ElevenLabsTextToSpeechScreen(modifier: Modifier = Modifier, refreshToken: Int) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val apiKey = container.apiKeyStore.getApiKey().orEmpty()

    var voices by remember { mutableStateOf<List<ClonedVoice>>(emptyList()) }
    var selectedVoice by remember { mutableStateOf<ClonedVoice?>(null) }
    var text by remember { mutableStateOf("") }
    var isGenerating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val defaultModelId by container.settingsRepository.defaultModelId.collectAsState(initial = TTS_MODELS.first().id)
    val settings by container.settingsRepository.defaultSettings.collectAsState(initial = VoiceGenerationSettings.RECOMMENDED)
    var selectedModel by remember(defaultModelId) {
        mutableStateOf(TTS_MODELS.firstOrNull { it.id == defaultModelId } ?: TTS_MODELS.first())
    }

    val allClips by container.historyRepository.clips.collectAsState(initial = emptyList())
    val ttsClips = allClips.filter { it.kind == ClipKind.TEXT_TO_SPEECH }
    val playingPath by container.audioPlayer.playingPath.collectAsState()

    LaunchedEffect(refreshToken) {
        container.elevenLabsApi.listVoices(apiKey).onSuccess { list ->
            voices = list
            if (selectedVoice == null) selectedVoice = list.firstOrNull()
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text("Testo → voce") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
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

            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text("Testo da far dire alla voce clonata") },
                placeholder = { Text("Scrivi qui, oppure detta a voce con il microfono →") },
                minLines = 4,
                trailingIcon = { MicDictationButton(currentText = text, onTextChanged = { text = it }) },
                modifier = Modifier.fillMaxWidth()
            )

            ModelDropdown(
                selected = selectedModel,
                onSelected = {
                    selectedModel = it
                    scope.launch { container.settingsRepository.setDefaultModelId(it.id) }
                },
                modifier = Modifier.fillMaxWidth()
            )

            VoiceSettingsPanel(
                settings = settings,
                showSpeed = selectedModel.supportsSpeed,
                onSettingsChanged = { scope.launch { container.settingsRepository.setDefaultSettings(it) } }
            )

            errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Button(
                onClick = {
                    val voice = selectedVoice
                    if (voice == null) {
                        errorMessage = "Seleziona una voce"
                        return@Button
                    }
                    if (text.isBlank()) {
                        errorMessage = "Scrivi (o detta) il testo da leggere"
                        return@Button
                    }
                    isGenerating = true
                    errorMessage = null
                    val outputFile = File(container.historyRepository.clipsDir(), "tts_${System.currentTimeMillis()}.mp3")
                    scope.launch {
                        container.elevenLabsApi.textToSpeech(
                            apiKey = apiKey,
                            voiceId = voice.voiceId,
                            text = text,
                            model = selectedModel,
                            languageCode = "it",
                            settings = settings,
                            outputFile = outputFile
                        ).onSuccess { file ->
                            isGenerating = false
                            container.historyRepository.addClip(
                                GeneratedClip(
                                    id = UUID.randomUUID().toString(),
                                    kind = ClipKind.TEXT_TO_SPEECH,
                                    voiceName = voice.name,
                                    sourceLabel = text,
                                    modelId = selectedModel.id,
                                    settings = settings,
                                    filePath = file.absolutePath,
                                    createdAtEpochMillis = System.currentTimeMillis()
                                )
                            )
                            container.audioPlayer.play(file)
                        }.onFailure {
                            isGenerating = false
                            errorMessage = it.message ?: "Impossibile generare l'audio"
                        }
                    }
                },
                enabled = !isGenerating && selectedVoice != null,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isGenerating) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(end = 8.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Text("Genero l'audio…")
                } else {
                    Text("Genera audio")
                }
            }

            ClipHistoryList(
                clips = ttsClips,
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SelfHostedTextToSpeechScreen(modifier: Modifier = Modifier) {
    val container = LocalAppContainer.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val serverUrl by container.settingsRepository.serverUrl.collectAsState(initial = "")
    val voices by container.localVoiceRepository.voices.collectAsState(initial = emptyList())
    var selectedVoice by remember { mutableStateOf<LocalVoice?>(null) }
    LaunchedEffect(voices) { if (selectedVoice == null) selectedVoice = voices.firstOrNull() }

    var text by remember { mutableStateOf("") }
    var isGenerating by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val settings by container.settingsRepository.selfHostedSettings.collectAsState(initial = SelfHostedGenerationSettings.RECOMMENDED)

    val allClips by container.historyRepository.clips.collectAsState(initial = emptyList())
    val ttsClips = allClips.filter { it.kind == ClipKind.TEXT_TO_SPEECH }
    val playingPath by container.audioPlayer.playingPath.collectAsState()

    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text("Testo → voce") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (serverUrl.isBlank()) {
                Text(
                    "Configura l'indirizzo del server personale in Impostazioni prima di generare.",
                    color = MaterialTheme.colorScheme.error
                )
            }

            if (voices.isEmpty()) {
                Text(
                    "Non hai ancora nessuna voce. Vai nella tab \"Voci\" per crearne una (bastano " +
                        "pochi secondi di campione).",
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                LocalVoiceDropdown(
                    voices = voices,
                    selected = selectedVoice,
                    onSelected = { selectedVoice = it },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text("Testo da far dire alla voce clonata") },
                placeholder = { Text("Scrivi qui, oppure detta a voce con il microfono →") },
                minLines = 4,
                trailingIcon = { MicDictationButton(currentText = text, onTextChanged = { text = it }) },
                modifier = Modifier.fillMaxWidth()
            )

            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Velocità", style = MaterialTheme.typography.bodyLarge)
                        Text(
                            "%.2f".format(settings.speed),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    Slider(
                        value = settings.speed,
                        onValueChange = { newSpeed ->
                            scope.launch { container.settingsRepository.setSelfHostedSettings(settings.copy(speed = newSpeed)) }
                        },
                        valueRange = 0.5f..1.8f
                    )
                }
            }

            errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Button(
                onClick = {
                    val voice = selectedVoice
                    if (serverUrl.isBlank()) {
                        errorMessage = "Configura l'indirizzo del server in Impostazioni"
                        return@Button
                    }
                    if (voice == null) {
                        errorMessage = "Seleziona (o crea) una voce"
                        return@Button
                    }
                    if (text.isBlank()) {
                        errorMessage = "Scrivi (o detta) il testo da leggere"
                        return@Button
                    }
                    isGenerating = true
                    errorMessage = null
                    val outputFile = File(container.historyRepository.clipsDir(), "tts_${System.currentTimeMillis()}.mp3")
                    scope.launch {
                        container.xttsServerApi.textToSpeech(
                            baseUrl = serverUrl,
                            text = text,
                            language = "it",
                            speed = settings.speed,
                            speakerSamples = voice.sampleFilePaths.map { File(it) },
                            outputFile = outputFile
                        ).onSuccess { file ->
                            isGenerating = false
                            container.historyRepository.addClip(
                                GeneratedClip(
                                    id = UUID.randomUUID().toString(),
                                    kind = ClipKind.TEXT_TO_SPEECH,
                                    voiceName = voice.name,
                                    sourceLabel = text,
                                    modelId = "xtts_v2_local",
                                    settings = VoiceGenerationSettings(speed = settings.speed),
                                    filePath = file.absolutePath,
                                    createdAtEpochMillis = System.currentTimeMillis()
                                )
                            )
                            container.audioPlayer.play(file)
                        }.onFailure {
                            isGenerating = false
                            errorMessage = it.message ?: "Impossibile generare l'audio"
                        }
                    }
                },
                enabled = !isGenerating && selectedVoice != null && serverUrl.isNotBlank(),
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isGenerating) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(end = 8.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Text("Genero l'audio (può richiedere un po' sulla prima generazione)…")
                } else {
                    Text("Genera audio")
                }
            }

            ClipHistoryList(
                clips = ttsClips,
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
