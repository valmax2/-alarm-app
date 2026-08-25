package it.vstudioapps.stylestudio3d.domain.ai

/**
 * Esito strutturato di una chiamata IA, pensato per essere mostrato in UI senza mai esporre
 * eccezioni o messaggi tecnici grezzi (stacktrace, codici HTTP nudi, ecc.).
 */
sealed interface AiOutcome<out T> {
    data class Successo<T>(val dato: T, val fonte: it.vstudioapps.stylestudio3d.domain.model.GenerationSource) : AiOutcome<T>
    /** L'utente non ha ancora collegato un abbonamento AI: non e' un errore, e' uno stato atteso. */
    data object NonConfigurato : AiOutcome<Nothing>
    data class ErroreRete(val messaggio: String) : AiOutcome<Nothing>
    data class ErroreProvider(val messaggio: String) : AiOutcome<Nothing>
}

inline fun <T, R> AiOutcome<T>.map(transform: (T) -> R): AiOutcome<R> = when (this) {
    is AiOutcome.Successo -> AiOutcome.Successo(transform(dato), fonte)
    is AiOutcome.NonConfigurato -> AiOutcome.NonConfigurato
    is AiOutcome.ErroreRete -> this
    is AiOutcome.ErroreProvider -> this
}
