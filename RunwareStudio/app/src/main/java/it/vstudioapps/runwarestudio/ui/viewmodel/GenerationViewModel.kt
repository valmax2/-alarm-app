package it.vstudioapps.runwarestudio.ui.viewmodel

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import it.vstudioapps.runwarestudio.RunwareStudioApplication
import it.vstudioapps.runwarestudio.data.ModelCatalog
import it.vstudioapps.runwarestudio.data.api.ImageInferenceRequest
import it.vstudioapps.runwarestudio.data.prompt.PromptOptimizer
import it.vstudioapps.runwarestudio.model.ArchiveJob
import it.vstudioapps.runwarestudio.model.GenerationParams
import it.vstudioapps.runwarestudio.model.GenerationStatus
import it.vstudioapps.runwarestudio.model.ModelPreset
import it.vstudioapps.runwarestudio.model.toDefaultParams
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val promptIt: String = "",
    /** The prompt actually sent to Runware once a generation runs — the plain EN translation
     *  when [autoOptimizeEnabled] is off, or PromptOptimizer's per-model version when it's on.
     *  Shown back to the user so the automation is never a black box. */
    val translatedPreview: String = "",
    val selectedModel: ModelPreset = ModelCatalog.default,
    val params: GenerationParams = ModelCatalog.default.toDefaultParams(),
    val referenceImages: List<Uri> = emptyList(),
    /** "Fai tutto in automatico": when true, PromptOptimizer adapts the translated prompt to
     *  the selected model's conventions before it's sent. Off = exactly what was translated,
     *  untouched, for full manual control. Defaults on since it only ever adds to what the
     *  user wrote, never removes or reinterprets it. */
    val autoOptimizeEnabled: Boolean = true,
    val status: GenerationStatus = GenerationStatus.Idle,
    /** Local file paths of the last successful run's results, read back from the archive so
     *  Home always shows the same durable copy the archive itself has. */
    val resultPaths: List<String> = emptyList(),
    val errorMessage: String? = null
) {
    val isBusy: Boolean get() = status is GenerationStatus.Translating ||
        status is GenerationStatus.UploadingReferences ||
        status is GenerationStatus.Generating
}

/**
 * Owns the whole "scrivi in italiano -> traduci -> genera" flow on Home: translation, optional
 * reference-image upload, the Runware call itself, and archiving the result. UI state is a
 * single StateFlow<HomeUiState> the composable renders directly and drives via the public
 * update functions below.
 */
class GenerationViewModel(application: Application) : AndroidViewModel(application) {

    private val container get() = getApplication<RunwareStudioApplication>()

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState

    init {
        // Restore the last-used model once on launch so re-opening the app doesn't reset back
        // to the catalog's first entry every time.
        viewModelScope.launch {
            val lastId = container.settingsRepository.settings.first().lastSelectedModelId
            ModelCatalog.byId(lastId)?.let { preset ->
                _uiState.update { it.copy(selectedModel = preset, params = preset.toDefaultParams()) }
            }
        }
    }

    fun updatePromptIt(text: String) {
        _uiState.update { it.copy(promptIt = text, translatedPreview = "") }
    }

    fun selectModel(preset: ModelPreset) {
        _uiState.update { it.copy(selectedModel = preset, params = preset.toDefaultParams()) }
        viewModelScope.launch { container.settingsRepository.setLastSelectedModelId(preset.id) }
    }

    fun updateParams(transform: (GenerationParams) -> GenerationParams) {
        _uiState.update { it.copy(params = transform(it.params)) }
    }

    fun addReferenceImages(uris: List<Uri>) {
        _uiState.update {
            // ACE++ character consistency and classic img2img both work fine with a small
            // handful of references; cap at 4 so the upload step stays fast.
            val merged = (it.referenceImages + uris).distinct().take(4)
            it.copy(referenceImages = merged)
        }
    }

    /** "Riusa questi parametri" from a JobDetailScreen: reloads Home with that job's prompt,
     *  model and parameters so the user can tweak and regenerate instead of starting blank.
     *  Falls back to whatever model is already selected if the job's model was removed from
     *  the catalog since. */
    fun loadFromArchiveJob(job: ArchiveJob) {
        val model = ModelCatalog.byId(job.modelId) ?: _uiState.value.selectedModel
        val referenceUris = job.referenceImagePaths.map { Uri.fromFile(File(it)) }
        _uiState.update {
            it.copy(
                promptIt = job.promptIt,
                translatedPreview = job.promptEn,
                selectedModel = model,
                params = job.params,
                referenceImages = referenceUris,
                status = GenerationStatus.Idle,
                resultPaths = emptyList(),
                errorMessage = null
            )
        }
    }

    fun removeReferenceImage(uri: Uri) {
        _uiState.update { it.copy(referenceImages = it.referenceImages - uri) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun setAutoOptimizeEnabled(enabled: Boolean) {
        _uiState.update { it.copy(autoOptimizeEnabled = enabled) }
    }

    fun generate() {
        val state = _uiState.value
        if (state.isBusy) return
        if (state.promptIt.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Scrivi prima una descrizione in italiano") }
            return
        }
        if (!container.secureKeyStore.hasApiKey()) {
            _uiState.update {
                it.copy(errorMessage = "Aggiungi la tua API key di Runware nelle Impostazioni prima di generare")
            }
            return
        }

        val model = state.selectedModel
        val params = state.params

        viewModelScope.launch {
            _uiState.update { it.copy(status = GenerationStatus.Translating, resultPaths = emptyList()) }
            val translation = container.translator.translate(state.promptIt)
            val rawEn = translation.getOrElse { e ->
                fail(e.message ?: "Traduzione non riuscita")
                return@launch
            }
            // "Ottimizzazione automatica": adapts the translated prompt to what this specific
            // model responds well to (Pony score tags, photographic terms, ...). Off means the
            // raw translation goes out exactly as written — see PromptOptimizer.
            val promptEn = if (state.autoOptimizeEnabled) {
                PromptOptimizer.optimizePositive(rawEn, model)
            } else {
                rawEn
            }
            _uiState.update { it.copy(translatedPreview = promptEn) }

            val storage = container.archiveRepository.imageStorage()
            val referenceUUIDs = mutableListOf<String>()
            if (state.referenceImages.isNotEmpty()) {
                _uiState.update { it.copy(status = GenerationStatus.UploadingReferences) }
                for (uri in state.referenceImages) {
                    val dataUri = runCatching { storage.toDataUri(uri) }.getOrElse { e ->
                        fail(e.message ?: "Impossibile leggere un'immagine di riferimento")
                        return@launch
                    }
                    val uploaded = container.apiClient.uploadImage(dataUri)
                    val imageUUID = uploaded.getOrElse { e ->
                        fail(e.message ?: "Caricamento immagine di riferimento non riuscito")
                        return@launch
                    }
                    referenceUUIDs += imageUUID
                }
            }

            _uiState.update { it.copy(status = GenerationStatus.Generating) }
            val request = ImageInferenceRequest(
                positivePrompt = promptEn,
                negativePrompt = params.negativePrompt,
                model = model.air,
                width = params.width,
                height = params.height,
                steps = params.steps,
                cfgScale = params.cfgScale,
                numberResults = params.numberResults,
                scheduler = params.scheduler,
                seed = params.seed,
                checkNsfw = params.checkNsfw,
                referenceImageUUIDs = referenceUUIDs,
                referenceStrength = params.referenceStrength,
                useCharacterConsistency = model.supportsCharacterReference && referenceUUIDs.isNotEmpty()
            )
            val generated = container.apiClient.generateImages(request)
            val images = generated.getOrElse { e ->
                fail(e.message ?: "Generazione non riuscita")
                return@launch
            }
            val resultUrls = images.mapNotNull { it.remoteUrl }
            if (resultUrls.isEmpty()) {
                fail("Runware non ha restituito immagini")
                return@launch
            }

            val jobId = runCatching {
                container.archiveRepository.saveCompletedJob(
                    promptIt = state.promptIt,
                    promptEn = promptEn,
                    model = model,
                    params = params,
                    referenceUris = state.referenceImages,
                    resultUrls = resultUrls
                )
            }.getOrElse { e ->
                fail(e.message ?: "Salvataggio nell'archivio non riuscito")
                return@launch
            }

            val savedJob = container.archiveRepository.getJob(jobId)
            _uiState.update {
                it.copy(
                    status = GenerationStatus.Success(jobId),
                    resultPaths = savedJob?.resultImagePaths ?: emptyList()
                )
            }
        }
    }

    private fun fail(message: String) {
        _uiState.update { it.copy(status = GenerationStatus.Error(message), errorMessage = message) }
    }

    // The translator is an Application-scoped singleton (see RunwareStudioApplication) shared
    // with whatever else might need it, so it's intentionally never closed here — only when
    // the process itself dies, same as the rest of the DI container.
}
