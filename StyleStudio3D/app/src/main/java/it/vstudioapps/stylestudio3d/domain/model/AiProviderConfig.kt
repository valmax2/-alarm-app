package it.vstudioapps.stylestudio3d.domain.model

/**
 * Preset per adattare le chiamate al formato piu' comune di API "compatibili OpenAI" (usato da
 * molti abbonamenti IA, inclusi provider terzi), oppure un endpoint completamente personalizzato
 * quando il formato del provider dell'utente e' diverso.
 */
enum class AiProviderPreset(val etichetta: String) {
    OPENAI_COMPATIBLE("Compatibile OpenAI (chat/images edit)"),
    PERSONALIZZATO("Endpoint personalizzato"),
}

/**
 * Configurazione (non segreta) dell'abbonamento IA "porta il tuo account" dell'utente.
 * L'API key NON vive qui: e' salvata separatamente in [it.vstudioapps.stylestudio3d.data.SecureCredentialStore],
 * cifrata con Android Keystore, cosi' questo oggetto puo' essere loggato/mostrato in UI senza rischi.
 */
data class AiProviderConfig(
    val preset: AiProviderPreset = AiProviderPreset.OPENAI_COMPATIBLE,
    val baseUrl: String = "",
    val model: String = "",
    val hasApiKeyConfigured: Boolean = false,
) {
    val isUsable: Boolean get() = baseUrl.isNotBlank() && hasApiKeyConfigured
}
