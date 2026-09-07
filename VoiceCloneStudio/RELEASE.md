# Checklist per pubblicare VoiceClone Studio su Google Play

Cosa è già pronto nel codice e cosa manca da fare tu, in ordine. Nessuno di questi passaggi
può essere completato da un'AI: richiedono un tuo account e le tue credenziali.

## 1. Chiave di firma

Genera un `release.keystore` (es. con `keytool -genkeypair -v -keystore release.keystore
-alias voiceclonestudio_upload -keyalg RSA -keysize 2048 -validity 10000`), poi copia
`keystore.properties.example` in `keystore.properties` nella cartella `VoiceCloneStudio/` e
compilalo con i valori reali.

⚠️ **Salva una copia di `release.keystore` e `keystore.properties` in un posto sicuro e
separato** (password manager, drive cifrato). Se li perdi, non potrai più pubblicare
aggiornamenti sotto lo stesso annuncio dell'app — dovresti pubblicarla come app nuova,
perdendo recensioni e installazioni.

## 2. Account sviluppatore Google Play

Vai su [play.google.com/console](https://play.google.com/console/signup) se non ne hai già
uno (25$ una tantum, richiede verifica d'identità).

## 3. Privacy Policy pubblica — testo già pronto

Il testo è in `docs/voiceclonestudio-privacy-policy.html` (nella root del repository, non
dentro `VoiceCloneStudio/`). Se hai già pubblicato `docs/` con GitHub Pages per un'altra app di
questo repository, la pagina è già online:

```
https://valmax2.github.io/-alarm-app/voiceclonestudio-privacy-policy.html
```

Altrimenti: GitHub → repository `-alarm-app` → **Settings → Pages** → Source "Deploy from a
branch", branch `main`, cartella `/docs`.

## 4. Chiave API ElevenLabs — è dell'utente, non tua

A differenza delle altre app di questo repository, VoiceClone Studio **non funziona senza
che ogni utente inserisca la propria chiave API ElevenLabs** (la app la chiede al primo avvio).
Non c'è nulla da configurare lato tuo per questo: non è una chiave che paghi o distribuisci tu.

## 5. Compilare la versione da pubblicare

Con `release.keystore` e `keystore.properties` copiati nella cartella `VoiceCloneStudio/`:

```bash
./gradlew bundleRelease
```

Il file da caricare su Play Console è in
`app/build/outputs/bundle/release/app-release.aab`.

## 6. Scheda dello store

Testi pronti in [`PLAY_STORE_LISTING.md`](PLAY_STORE_LISTING.md). Mancano ancora, da fare tu:
- **screenshot reali** del telefono (almeno 2, presi avviando l'app);
- una **feature graphic** 1024×500 px.

## 7. Modulo permessi sensibili

Play Console chiede di dichiarare l'uso del microfono e la condivisione di dati con terze
parti (ElevenLabs) — i testi suggeriti sono in fondo a `PLAY_STORE_LISTING.md`.

## 8. Pubblicazione

Carica l'`.aab` in un canale di test chiuso prima del rilascio pubblico — è il modo più
sicuro per scoprire problemi con utenti reali di poche persone prima di aprirlo a tutti.
