# Fort Knox Vault — prototipo Android

Prototipo nativo Android in Kotlin e Jetpack Compose, ispirato alla serratura
meccanica fornita come riferimento.

## Funzioni incluse

- onboarding con codice principale e codice di recupero offline;
- ghiera interattiva con feedback aptico;
- sblocco tramite combinazione, PIN/password o biometria Android;
- cartelle personalizzate;
- importazione multipla tramite Storage Access Framework;
- cifratura per-file AES-256-GCM con chiave non esportabile in Android Keystore;
- indice e nomi dei file cifrati;
- tentativo di eliminazione dell’originale dopo un’importazione riuscita;
- anteprima interna delle immagini;
- pacchetti di condivisione `.vsafe` cifrati con password;
- blocco screenshot/registrazione, esclusione dai backup e blocco automatico;
- interfaccia dark “acciaio e ottone”, Dark Mode nativa e semantica Compose.

## Come aprire il progetto

1. Installa Android Studio e l’SDK Android 35.
2. Apri la cartella `FortKnoxVault`.
3. Attendi la sincronizzazione Gradle.
4. Avvia su un telefono Android 9 o successivo. Per testare la biometria,
   configura prima impronta o volto nelle impostazioni del dispositivo.

Su Windows puoi anche compilare dalla cartella del progetto con:

```bat
gradlew.bat assembleDebug
```

L’APK di debug verrà creato in `app\build\outputs\apk\debug\`.

## Limiti consapevoli del prototipo

- Alcuni provider Android non consentono a un’app di eliminare il file originale:
  in quel caso l’app segnala chiaramente che deve essere rimosso manualmente.
- I pacchetti `.vsafe` possono essere importati da un’altra installazione
  dell’app tramite l’icona del lucchetto aperto dentro una cartella.
- L’anteprima interna completa per PDF e documenti Office e il recupero account
  richiedono componenti aggiuntivi e backend.
- Disinstallare l’app elimina l’archivio locale. Prima della pubblicazione serve
  un backup cifrato end-to-end opzionale.

## Sicurezza prima della pubblicazione

Il prototipo implementa basi solide, ma una vera app “vault” richiede almeno:

- threat model formale e revisione crittografica indipendente;
- test su dispositivi OEM e versioni Android supportate;
- cancellazione affidabile delle copie temporanee e test dei provider;
- rate limiting con ritardi progressivi e invalidazione controllata;
- protezioni contro device rooted/debugger e hardening R8;
- backend zero-knowledge per recupero account e backup cifrato;
- test OWASP MASVS, privacy policy e Data Safety del Play Store.
