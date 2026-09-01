package it.vstudioapps.runwarestudio

import android.app.Application
import it.vstudioapps.runwarestudio.data.api.RunwareApiClient
import it.vstudioapps.runwarestudio.data.api.SegmindApiClient
import it.vstudioapps.runwarestudio.data.archive.ArchiveRepository
import it.vstudioapps.runwarestudio.data.settings.SecureKeyStore
import it.vstudioapps.runwarestudio.data.settings.SettingsRepository
import it.vstudioapps.runwarestudio.data.translate.PromptTranslator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Hand-rolled DI container: every screen's ViewModel pulls its dependencies from here (via
 * `(application as RunwareStudioApplication)`) instead of each constructing its own —
 * mirrors FaceGuard/FortKnoxVault's MainActivity-holds-the-repositories pattern, just moved
 * up to Application since here three different screens' ViewModels all need the same
 * singletons (archive database, API client, secure key store).
 */
class RunwareStudioApplication : Application() {

    val settingsRepository by lazy { SettingsRepository(this) }
    val secureKeyStore by lazy { SecureKeyStore(this) }
    val archiveRepository by lazy { ArchiveRepository(this) }
    val translator by lazy { PromptTranslator() }
    val apiClient by lazy {
        RunwareApiClient(apiKeyProvider = { withContext(Dispatchers.IO) { secureKeyStore.getApiKey() } })
    }
    val segmindApiClient by lazy {
        SegmindApiClient(apiKeyProvider = { withContext(Dispatchers.IO) { secureKeyStore.getSegmindApiKey() } })
    }
}
