package it.vstudioapps.runwarestudio.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import it.vstudioapps.runwarestudio.RunwareStudioApplication
import it.vstudioapps.runwarestudio.model.AppSettings
import it.vstudioapps.runwarestudio.model.ThemeMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface ConnectionTestState {
    data object Idle : ConnectionTestState
    data object Testing : ConnectionTestState
    data object Success : ConnectionTestState
    data class Failure(val message: String) : ConnectionTestState
}

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val container get() = getApplication<RunwareStudioApplication>()

    val settings: StateFlow<AppSettings> = container.settingsRepository.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppSettings())

    private val _apiKeyPresent = MutableStateFlow(container.secureKeyStore.hasApiKey())
    val apiKeyPresent: StateFlow<Boolean> = _apiKeyPresent

    private val _segmindKeyPresent = MutableStateFlow(container.secureKeyStore.hasSegmindApiKey())
    val segmindKeyPresent: StateFlow<Boolean> = _segmindKeyPresent

    private val _connectionTest = MutableStateFlow<ConnectionTestState>(ConnectionTestState.Idle)
    val connectionTest: StateFlow<ConnectionTestState> = _connectionTest

    private val _archiveCleared = MutableStateFlow(false)
    val archiveCleared: StateFlow<Boolean> = _archiveCleared

    fun currentApiKey(): String? = container.secureKeyStore.getApiKey()

    fun setApiKey(key: String) {
        container.secureKeyStore.setApiKey(key)
        _apiKeyPresent.value = container.secureKeyStore.hasApiKey()
        _connectionTest.value = ConnectionTestState.Idle
    }

    fun clearApiKey() {
        container.secureKeyStore.setApiKey(null)
        _apiKeyPresent.value = false
        _connectionTest.value = ConnectionTestState.Idle
    }

    fun currentSegmindApiKey(): String? = container.secureKeyStore.getSegmindApiKey()

    fun setSegmindApiKey(key: String) {
        container.secureKeyStore.setSegmindApiKey(key)
        _segmindKeyPresent.value = container.secureKeyStore.hasSegmindApiKey()
    }

    fun clearSegmindApiKey() {
        container.secureKeyStore.setSegmindApiKey(null)
        _segmindKeyPresent.value = false
    }

    fun testConnection() {
        if (_connectionTest.value == ConnectionTestState.Testing) return
        viewModelScope.launch {
            _connectionTest.value = ConnectionTestState.Testing
            val result = container.apiClient.testConnection()
            _connectionTest.value = result.fold(
                onSuccess = { ConnectionTestState.Success },
                onFailure = { ConnectionTestState.Failure(it.message ?: "Connessione non riuscita") }
            )
        }
    }

    fun setOnboardingCompleted(completed: Boolean) {
        viewModelScope.launch { container.settingsRepository.setOnboardingCompleted(completed) }
    }

    fun setAdultTermsAccepted(accepted: Boolean) {
        viewModelScope.launch { container.settingsRepository.setAdultTermsAccepted(accepted) }
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { container.settingsRepository.setThemeMode(mode) }
    }

    fun clearArchive() {
        viewModelScope.launch {
            container.archiveRepository.clearAll()
            _archiveCleared.value = true
        }
    }

    fun consumeArchiveClearedEvent() {
        _archiveCleared.value = false
    }
}
