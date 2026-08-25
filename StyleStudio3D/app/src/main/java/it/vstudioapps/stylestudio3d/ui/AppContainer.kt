package it.vstudioapps.stylestudio3d.ui

import android.content.Context
import it.vstudioapps.stylestudio3d.data.GenerationHistoryRepository
import it.vstudioapps.stylestudio3d.data.SecureCredentialStore
import it.vstudioapps.stylestudio3d.data.StyleCatalogRepository
import it.vstudioapps.stylestudio3d.data.UserPreferencesRepository
import it.vstudioapps.stylestudio3d.data.WardrobeRepository
import it.vstudioapps.stylestudio3d.domain.ai.AiServiceFactory
import it.vstudioapps.stylestudio3d.drive.GoogleDriveSyncService
import it.vstudioapps.stylestudio3d.tts.NarratedGuide
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Contenitore di dipendenze costruito una sola volta in [it.vstudioapps.stylestudio3d.MainActivity].
 * Niente framework di injection: l'app ha un solo modulo e un grafo di dipendenze piccolo e
 * stabile, un framework aggiungerebbe complessita' senza un vantaggio reale qui.
 */
class AppContainer(context: Context) {
    val appContext: Context = context.applicationContext
    val scopeApp = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val preferenzeUtente = UserPreferencesRepository(appContext)
    val credenzialiSicure = SecureCredentialStore(appContext)
    val catalogoStili = StyleCatalogRepository(appContext)
    val guardaroba = WardrobeRepository(appContext)
    val cronologiaCreazioni = GenerationHistoryRepository(appContext)
    val guidaVocale = NarratedGuide(appContext)

    val serviziAi = AiServiceFactory(
        configProvider = { preferenzeUtenteCorrenti().toAiProviderConfig() },
        apiKeyProvider = { credenzialiSicure.leggiAiApiKey() },
    )

    val driveSyncService = GoogleDriveSyncService(appContext, guardaroba, cronologiaCreazioni)

    // Cache aggiornata da un collector avviato in inizializza(): AiServiceFactory ha bisogno di
    // un valore sincrono al momento della chiamata, non puo' sospendere per leggere il DataStore.
    @Volatile
    private var ultimePreferenze = it.vstudioapps.stylestudio3d.data.UserPreferences()
    private fun preferenzeUtenteCorrenti() = ultimePreferenze

    fun inizializza() {
        scopeApp.launch { catalogoStili.inizializza() }
        scopeApp.launch { guardaroba.inizializza() }
        scopeApp.launch { cronologiaCreazioni.inizializza() }
        scopeApp.launch { preferenzeUtente.preferenze.collect { ultimePreferenze = it } }
        guidaVocale.inizializza()
    }
}
