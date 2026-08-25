package it.vstudioapps.stylestudio3d.tts

data class OnboardingStep(val titolo: String, val testo: String)

/**
 * Tutorial scritto, passo per passo, mostrato al primo avvio e letto ad alta voce da
 * [NarratedGuide]. Un passo per ogni categoria principale dell'app.
 */
object OnboardingScript {
    val passi: List<OnboardingStep> = listOf(
        OnboardingStep(
            "Benvenuto in Style Studio 3D",
            "Qui puoi creare e provare nuovi look: capelli, barba, trucco, abbigliamento e scarpe, " +
                "per capire cosa ti sta bene prima ancora di indossarlo davvero. " +
                "Ogni categoria ha un pulsante dedicato nella schermata principale: nessuno scorrimento infinito, " +
                "tutto e' organizzato e a portata di tocco.",
        ),
        OnboardingStep(
            "Capelli e Barba",
            "In \"Capelli\" scegli tra decine di acconciature gia' pronte oppure creane una tua: scrivi il nome " +
                "che vuoi, in italiano o in un'altra lingua, imposta lunghezza, volume e colore e tocca \"Crea\". " +
                "Tieni premuto su un'acconciatura per vederne l'anteprima ingrandita. La stessa logica vale per " +
                "barba e baffi.",
        ),
        OnboardingStep(
            "Trucco",
            "In \"Trucco\" trovi look pronti per il giorno, la sera o occasioni speciali, e puoi crearne di nuovi " +
                "allo stesso modo dei capelli. L'intelligenza artificiale del tuo abbonamento, se collegato nelle " +
                "Impostazioni, applica lo stile scelto alla tua foto.",
        ),
        OnboardingStep(
            "Abbigliamento e Scarpe",
            "Carica una foto di un capo o di un paio di scarpe per aggiungerlo al tuo guardaroba virtuale. " +
                "Da li' puoi provarlo virtualmente caricando una tua foto: l'app mostra come apparirebbe indosso.",
        ),
        OnboardingStep(
            "Armocromia",
            "Rispondi a poche domande veloci su incarnato e contrasto: l'app calcola la tua stagione cromatica " +
                "e ti mostra subito quali capi del tuo guardaroba si abbinano meglio.",
        ),
        OnboardingStep(
            "Figura intera e Studio Fotografico",
            "In \"Figura intera\" vedi il modello con tutte le scelte fatte finora, e puoi ruotarlo trascinando " +
                "il dito. Quando sei pronto, passa allo \"Studio Fotografico\": scegli inquadratura, angolo di " +
                "ripresa, luci e sfondo, poi tocca \"Genera scatto\" per il risultato finale.",
        ),
        OnboardingStep(
            "Impostazioni",
            "Dalle Impostazioni colleghi il tuo abbonamento IA esistente, l'account Google per sincronizzare le " +
                "creazioni su Drive, e puoi riascoltare questo tutorial quando vuoi.",
        ),
    )
}
