package it.vstudioapps.stylestudio3d.domain.model

/** Risposte del breve questionario di armocromia (nessuna foto obbligatoria per iniziare). */
enum class Undertone(val etichetta: String) {
    CALDO("Caldo (vene verdastre, si abbronza facilmente, oro sta bene)"),
    FREDDO("Freddo (vene bluastre, scotta col sole, argento sta bene)"),
    NEUTRO("Neutro (un mix dei due, non e' chiaro)"),
}

enum class ValoreChiaroScuro(val etichetta: String) {
    CHIARO("Chiaro (pelle e capelli chiari)"),
    MEDIO("Medio"),
    SCURO("Scuro (pelle e/o capelli scuri)"),
}

enum class Cromia(val etichetta: String) {
    BRILLANTE("Alto contrasto, preferisco colori decisi"),
    TENUE("Basso contrasto, preferisco colori morbidi"),
}

data class ColorProfileInput(
    val undertone: Undertone,
    val valore: ValoreChiaroScuro,
    val cromia: Cromia,
)
