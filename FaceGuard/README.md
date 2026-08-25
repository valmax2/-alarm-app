# FaceGuard — prototipo Android

Prototipo nativo Android in Kotlin e Jetpack Compose che monitora la presenza
dell'utente tramite la fotocamera frontale e attiva una schermata di
copertura quando il volto non viene più rilevato per un tempo configurabile.

## Funzioni incluse

- rilevamento del volto in tempo reale con ML Kit (CameraX + Face Detection);
- foreground service dedicato, con notifica persistente di stato;
- tre modalità di copertura selezionabili: immagine personalizzata,
  schermo nero, blocco schermo (richiede l'amministratore del dispositivo);
- copertura disegnata sopra qualunque altra app tramite permesso
  "disegna sopra le altre app" (`SYSTEM_ALERT_WINDOW`);
- soglia di assenza configurabile (3–60 secondi);
- tema chiaro/scuro/sistema selezionabile dall'utente, indipendente dal
  tema di sistema, con interfaccia Material 3.

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
