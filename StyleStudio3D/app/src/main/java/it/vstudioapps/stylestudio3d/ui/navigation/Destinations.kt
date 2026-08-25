package it.vstudioapps.stylestudio3d.ui.navigation

/** Rotte di navigazione. Una schermata per ogni categoria del pulsante nella Home. */
object Destinations {
    const val ONBOARDING = "onboarding"
    const val HOME = "home"
    const val CAPELLI_BARBA = "capelli_barba"
    const val TRUCCO = "trucco"
    const val ABBIGLIAMENTO = "abbigliamento"
    const val SCARPE = "scarpe"
    const val ARMOCROMIA = "armocromia"
    const val FIGURA_INTERA = "figura_intera"
    const val STUDIO_FOTOGRAFICO = "studio_fotografico"
    const val RISULTATO = "risultato"
    const val IMPOSTAZIONI = "impostazioni"
    const val PROVA_VIRTUALE = "prova_virtuale/{capoId}"

    fun provaVirtuale(capoId: String) = "prova_virtuale/$capoId"
}
