package it.vstudioapps.stylestudio3d.domain.model

import kotlinx.serialization.Serializable

/**
 * Le tre famiglie di stili "parametrici" modificabili dall'IA (capelli, barba/baffi, trucco).
 * Abbigliamento e scarpe non sono qui: sono capi reali caricati come foto (vedi [WardrobeItem]),
 * non stili generati da parametri.
 */
@Serializable
enum class StyleCategory(val etichetta: String) {
    CAPELLI("Capelli"),
    BARBA("Barba & Baffi"),
    TRUCCO("Trucco");
}
