# VoiceClone Studio

App Android nativa (Kotlin + Jetpack Compose) per clonare la propria voce e generare audio con
quella voce, sia da testo scritto/dettato, sia convertendo un audio già registrato con un'altra
voce. Usa [ElevenLabs](https://elevenlabs.io) come motore di clonazione/generazione: è l'unico
modo realistico di ottenere una clonazione vocale di livello professionale su uno smartphone,
dato che i modelli che la rendono possibile (multi-GB, addestrati su enormi quantità di parlato)
non girano in modo decente sull'hardware di un telefono.

## Funzionalità

- **Clonazione istantanea della voce**: carichi o registri in-app qualche minuto di campioni
  audio e ElevenLabs genera una voce clonata pronta all'uso.
- **Testo → voce**: scrivi (o detta a voce, in italiano, con il pulsante microfono) un testo e lo
  fai leggere dalla voce clonata.
- **Conversione voce → voce**: registri o importi un audio con un'altra voce e lo "ridoppi" con
  il timbro della voce clonata, mantenendo tempi e intonazione originali.
- **Regolazioni fini**: stabilità, somiglianza al timbro, stile/espressività, velocità e
  potenziamento voce — gli stessi parametri che ElevenLabs espone per rifinire quanto il
  risultato assomiglia alla voce originale e quanto suona naturale (non robotico).
- **Modello multilingua ottimizzato per l'italiano**: di default usa `eleven_multilingual_v2`
  (la qualità migliore per l'italiano); Turbo/Flash sono selezionabili per generazioni più
  veloci, passando esplicitamente `language_code=it` per un accento più aderente.
- **Cronologia**: ogni clip generato resta salvato nell'app (riproducibile, condivisibile,
  eliminabile) insieme alle impostazioni che lo hanno prodotto.

## Perché una API cloud e non tutto on-device

Un vero motore di clonazione vocale "che assomiglia molto" alla voce originale richiede modelli
enormi con un footprint computazionale che nessun telefono gestisce con una latenza accettabile.
Le alternative on-device esistenti (motori TTS leggeri tipo VITS quantizzato) producono voci
sintetiche riconoscibili, non vere cloni. Per questo l'app fa da client verso ElevenLabs: i dati
audio/testo escono dal telefono solo verso i loro server, e serve una chiave API personale
(gratuita per iniziare, poi a consumo).

## Struttura del progetto

Segue la stessa struttura delle altre app native di questo repository (`FaceGuard/`,
`FortKnoxVault/`): un progetto Gradle/Kotlin autonomo con il proprio `build.gradle.kts`,
`debug.keystore` (fisso, così le build CI si aggiornano l'una sull'altra) e materiale per la
pubblicazione su Play Store.

```
VoiceCloneStudio/
├── app/src/main/java/it/vstudioapps/voiceclonestudio/
│   ├── data/       # ApiKeyStore, ElevenLabsApi, repository, modelli
│   ├── audio/      # registrazione e riproduzione locale
│   └── ui/         # schermate Compose (voci, testo→voce, conversione, impostazioni)
├── RELEASE.md      # checklist per pubblicare su Play Store
└── keystore.properties.example
```

## Compilare

```bash
./gradlew assembleDebug
```

L'APK risultante è firmato con il `debug.keystore` incluso nel repository, così ogni build (CI o
locale) può essere installata sopra la precedente senza conflitti di firma.
