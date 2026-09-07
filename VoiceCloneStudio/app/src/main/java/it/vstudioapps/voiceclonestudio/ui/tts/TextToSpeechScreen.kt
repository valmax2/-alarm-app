package it.vstudioapps.voiceclonestudio.ui.tts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import it.vstudioapps.voiceclonestudio.data.ClipKind
import it.vstudioapps.voiceclonestudio.data.ClonedVoice
import it.vstudioapps.voiceclonestudio.data.GeneratedClip
import it.vstudioapps.voiceclonestudio.data.TTS_MODELS
import it.vstudioapps.voiceclonestudio.data.VoiceGenerationSettings
import it.vstudioapps.voiceclonestudio.ui.common.ClipHistoryList
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import it.vstudioapps.voiceclonestudio.ui.common.MicDictationButton
import it.vstudioapps.voiceclonestudio.ui.common.ModelDropdown
import it.vstudioapps.voiceclonestudio.ui.common.VoiceDropdown
import it.vstudioapps.voiceclonestudio.ui.common.VoiceSettingsPanel
import it.vstudioapps.voiceclonestudio.ui.common.shareAudioFile
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

@Composable
fun TextToSpeechScreen(modifier: Modifier = Modifier, refreshToken: Int) {
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
