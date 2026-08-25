# Checklist per pubblicare FaceGuard su Google Play

Cosa è già pronto nel codice e cosa manca da fare tu, in ordine. Nessuno di questi
passaggi può essere completato da un'AI: richiedono un tuo account e le tue credenziali.

## 1. Chiave di firma — GIÀ FATTO, conservala

Ho generato `release.keystore` e `keystore.properties` (li trovi allegati, **non** nel
repository Git — di proposito, per sicurezza). Copiali entrambi dentro la cartella
`FaceGuard/` sul tuo computer prima di compilare la versione release.

⚠️ **Salva una copia di entrambi i file in un posto sicuro e separato** (es. un password
manager, un drive cifrato). Se li perdi, non potrai più pubblicare aggiornamenti sotto lo
stesso annuncio dell'app su Play Store — dovresti pubblicarla come app nuova, perdendo
recensioni e installazioni.

## 2. Account sviluppatore Google Play

Vai su [play.google.com/console](https://play.google.com/console/signup), crea un account
sviluppatore (25$ una tantum, richiede verifica d'identità).

## 3. Privacy Policy pubblica — testo già pronto

Il testo è in `docs/privacy-policy.html`. Per pubblicarlo con GitHub Pages (gratis):

1. Vai su GitHub → il repository `-alarm-app` → **Settings → Pages**.
2. In "Source" scegli **Deploy from a branch**, branch `main`, cartella `/docs`.
3. Salva. Dopo un paio di minuti la pagina sarà su un URL tipo:
   `https://valmax2.github.io/-alarm-app/privacy-policy.html`
4. Copia quell'URL: lo inserirai in Play Console → App content → Privacy Policy.

## 4. Prodotto in-app per FaceGuard Pro

In Play Console → il tuo app → **Monetizzazione → Prodotti → Prodotti in-app**, crea un
prodotto con questo **ID esatto** (deve corrispondere al codice):

```
faceguard_pro_unlock
```

Imposta il prezzo che preferisci, tipo "una tantum" (non abbonamento). Senza questo passaggio
il pulsante "Sblocca FaceGuard Pro" nell'app non troverà nulla da vendere.

## 5. Compilare la versione da pubblicare

Con `release.keystore` e `keystore.properties` copiati nella cartella `FaceGuard/`:

```bat
gradlew.bat bundleRelease
```

Il file da caricare su Play Console è in
`app/build/outputs/bundle/release/app-release.aab` (formato `.aab`, richiesto da Google
Play per le app nuove).

## 6. Scheda dello store

Testi pronti in [`PLAY_STORE_LISTING.md`](PLAY_STORE_LISTING.md). Mancano ancora, da fare tu:
- **screenshot reali** del telefono (almeno 2, presi avviando l'app);
- una **feature graphic** 1024×500 px.

## 7. Modulo permessi sensibili

Play Console chiede di dichiarare l'uso di fotocamera in background e overlay — i testi
suggeriti sono in fondo a `PLAY_STORE_LISTING.md`.

## 8. Crashlytics vero (facoltativo)

L'app oggi registra i crash solo localmente sul dispositivo (vedi README). Se vuoi vederli
anche tu da remoto:
1. Crea un progetto su [Firebase Console](https://console.firebase.google.com).
2. Aggiungi un'app Android con applicationId `it.vstudioapps.faceguard`.
3. Scarica `google-services.json` e mandamelo (o incollalo in `FaceGuard/app/`) — a quel
   punto posso integrare Firebase Crashlytics nel codice.

## 9. Pubblicazione

Carica l'`.aab` in un canale di test chiuso prima del rilascio pubblico — è il modo più
sicuro per scoprire problemi (incluso il flusso di acquisto Pro) con utenti reali di poche
persone prima di aprirlo a tutti.
