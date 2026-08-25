# FaceGuard — app Android

App nativa Android in Kotlin e Jetpack Compose che riconosce il volto del
proprietario del telefono tramite la fotocamera frontale e attiva una
schermata di copertura quando non lo riconosce più per un tempo configurabile.

## Funzioni incluse

- **riconoscimento del proprietario**, non solo rilevamento generico: durante
  la registrazione (protetta da conferma biometrica di sistema) l'app calcola
  un'impronta geometrica del volto da ML Kit Face Detection, cifrata con
  AES-256 nell'Android Keystore; solo un volto che corrisponde tiene lo
  schermo sbloccato;
- foreground service dedicato, con notifica persistente di stato;
- tre modalità di copertura: schermo nero (gratis), immagine personalizzata
  e blocco schermo (**FaceGuard Pro**, sblocco unico via Google Play Billing);
- copertura disegnata sopra qualunque altra app tramite permesso
  "disegna sopra le altre app" (`SYSTEM_ALERT_WINDOW`);
- soglia di assenza configurabile da 0 a 60 secondi, con slider e campo di
  testo per il valore esatto;
- riavvio automatico del monitoraggio dopo un riavvio del telefono, richiesta
  di esclusione dall'ottimizzazione batteria, log locale degli arresti anomali;
- tema chiaro/scuro/sistema selezionabile dall'utente, indipendente dal
  tema di sistema, con interfaccia Material 3.

Per la pubblicazione su Google Play vedi [`RELEASE.md`](RELEASE.md) e
[`PLAY_STORE_LISTING.md`](PLAY_STORE_LISTING.md).

## Come aprire il progetto

1. Installa Android Studio e l'SDK Android 35.
2. Apri la cartella `FaceGuard`.
3. Attendi la sincronizzazione Gradle.
4. Avvia su un telefono Android 8.0 (API 26) o successivo con fotocamera
   frontale.

Su Windows puoi anche compilare dalla cartella del progetto con:

```bat
gradlew.bat assembleDebug
```

L'APK di debug verrà creato in `app\build\outputs\apk\debug\`.

## Permessi richiesti

L'app li richiede singolarmente dalla schermata "Monitor", spiegando a cosa
serve ciascuno prima di aprire le impostazioni di sistema:

- **Fotocamera**: necessaria per il rilevamento del volto.
- **Notifiche**: mostra lo stato del monitoraggio nella notifica persistente
  del foreground service.
- **Disegna sopra le altre app**: necessaria per le modalità "Immagine
  personalizzata" e "Schermo nero".
- **Amministratore dispositivo**: necessaria solo per "Blocco schermo", per
  poter chiamare `DevicePolicyManager#lockNow()`. Revocabile in qualsiasi
  momento dalla schermata "Monitor".
- **Ottimizzazione batteria**: consigliata (non obbligatoria) per evitare che
  alcuni produttori terminino il servizio in background.
- **Impronta/Face Unlock di sistema**: richiesta solo per confermare
  l'identità prima di registrare o sostituire il profilo del volto.

## Limiti consapevoli del prototipo

- La copertura "Immagine personalizzata" e "Schermo nero" intercetta i tocchi
  sopra le altre app, ma non può impedire i tasti Home/Recenti di Android:
  bloccare anche quelli richiederebbe una modalità kiosk (Device Owner), fuori
  dallo scope di questo prototipo.
- Su alcuni dispositivi il sistema può sospendere l'accesso alla fotocamera
  quando lo schermo è bloccato dalla modalità "Blocco schermo": in quel caso
  il rilevamento riprende non appena l'utente sblocca il dispositivo.
- Il rilevamento gira in un servizio in foreground: il sistema può comunque
  terminarlo in condizioni di risparmio energia molto aggressive su alcuni
  produttori; l'utente potrebbe dover escludere l'app dall'ottimizzazione
  batteria per un monitoraggio realmente continuo.
- Nessun backend: tutte le preferenze restano solo sul dispositivo
  (`DataStore`), coerentemente con `allowBackup="false"`.
