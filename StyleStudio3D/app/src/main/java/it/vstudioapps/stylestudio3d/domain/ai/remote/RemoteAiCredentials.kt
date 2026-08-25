package it.vstudioapps.stylestudio3d.domain.ai.remote

import it.vstudioapps.stylestudio3d.domain.model.AiProviderConfig

/** [AiProviderConfig] unito alla API key in chiaro, tenuto solo in memoria per la durata di una chiamata. */
data class RemoteAiCredentials(
    val config: AiProviderConfig,
    val apiKey: String,
) {
    /**
     * Endpoint da chiamare per l'editing immagini. Con il preset "compatibile OpenAI" assumiamo
     * la forma pubblica e documentata delle API OpenAI Images (`POST /v1/images/edits`), usata
     * anche da diversi provider terzi compatibili; con "personalizzato" l'utente indica l'URL
     * completo del proprio endpoint in [AiProviderConfig.baseUrl].
     */
    fun endpointEditImmagine(): String = when (config.preset) {
        it.vstudioapps.stylestudio3d.domain.model.AiProviderPreset.OPENAI_COMPATIBLE ->
            config.baseUrl.trimEnd('/') + "/images/edits"
        it.vstudioapps.stylestudio3d.domain.model.AiProviderPreset.PERSONALIZZATO ->
            config.baseUrl
    }
}
