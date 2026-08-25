package it.vstudioapps.stylestudio3d.domain.ai

import it.vstudioapps.stylestudio3d.domain.ai.mock.MockHairMakeupAiService
import it.vstudioapps.stylestudio3d.domain.ai.mock.MockVirtualTryOnService
import it.vstudioapps.stylestudio3d.domain.ai.remote.RemoteAiCredentials
import it.vstudioapps.stylestudio3d.domain.ai.remote.RemoteHairMakeupAiService
import it.vstudioapps.stylestudio3d.domain.ai.remote.RemoteVirtualTryOnService
import it.vstudioapps.stylestudio3d.domain.model.AiProviderConfig

/**
 * Sceglie l'implementazione reale (abbonamento AI dell'utente) quando e' configurata, altrimenti
 * ricade sull'anteprima locale. Nessuna schermata dell'app dipende direttamente da Mock/Remote:
 * tutte passano da qui, cosi' collegare un vero abbonamento nelle Impostazioni cambia subito il
 * comportamento ovunque senza altre modifiche.
 */
class AiServiceFactory(
    private val configProvider: () -> AiProviderConfig,
    private val apiKeyProvider: () -> String?,
) {
    fun hairMakeupService(): HairMakeupAiService {
        val config = configProvider()
        val apiKey = apiKeyProvider()
        return if (config.isUsable && !apiKey.isNullOrBlank()) {
            RemoteHairMakeupAiService(RemoteAiCredentials(config, apiKey))
        } else {
            MockHairMakeupAiService()
        }
    }

    fun virtualTryOnService(): VirtualTryOnService {
        val config = configProvider()
        val apiKey = apiKeyProvider()
        return if (config.isUsable && !apiKey.isNullOrBlank()) {
            RemoteVirtualTryOnService(RemoteAiCredentials(config, apiKey))
        } else {
            MockVirtualTryOnService()
        }
    }
}
