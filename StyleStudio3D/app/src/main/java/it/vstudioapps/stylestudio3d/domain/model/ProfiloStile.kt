package it.vstudioapps.stylestudio3d.domain.model

/**
 * Scelto al primo avvio (e cambiabile dalle Impostazioni): decide quali categorie di stile ha
 * senso mostrare. Con "Donna" la barba/baffi non compare proprio, ne' in Home ne' nel catalogo —
 * non e' un semplice suggerimento, e' un filtro vero.
 */
enum class ProfiloStile(val etichetta: String) {
    UOMO("Uomo"),
    DONNA("Donna"),
    TUTTI("Mostra tutto"),
}
