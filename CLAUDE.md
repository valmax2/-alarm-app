# CLAUDE.md

Questo file fornisce indicazioni a Claude Code (claude.ai/code) per lavorare con il codice di questo repository.

## Panoramica del progetto

`alarm_app` ("Sveglia Demo" / bedside-clock-apk) è un'app demo Flutter per una schermata di sveglia con due modalità di sblocco: risolvere un enigma matematico o uno swipe. Android è l'unica piattaforma configurata (non esistono cartelle `ios/`, `web/`, ecc.). Le stringhe UI e i commenti nel codice sono scritti in italiano.

## Comandi

```bash
flutter pub get              # installa le dipendenze
flutter analyze              # analisi statica / lint (flutter_lints via analysis_options.yaml)
flutter test                 # esegue tutti i test
flutter test test/widget_test.dart                    # esegue un singolo file di test
flutter test --plain-name "AlarmDemoApp shows the alarm ring screen"  # esegue un singolo test per nome
flutter run                  # esegue l'app su un dispositivo/emulatore connesso
flutter build apk --release  # compila l'APK di release (stesso comando usato dalla CI)
```

La CI (`.github/workflows/build_apk.yml`) viene eseguita ad ogni push su `main`/`master`: lancia `flutter pub get` e poi `flutter build apk --release`, caricando `build/app/outputs/flutter-apk/app-release.apk` come artifact `bedside-clock-apk`. Non esiste un job CI separato per lint/test — `flutter analyze` e `flutter test` vanno eseguiti localmente prima del push.

## Architettura

L'app è volutamente minimale, con tutto il codice Dart sotto `lib/`:

- `lib/main.dart` — entry point. `AlarmDemoApp` è una `MaterialApp` (tema scuro) la cui `home` è direttamente una `AlarmRingScreen`; non c'è uno stack di navigazione/routing. Le callback `onDismissed`/`onSnoozed` passate qui sono solo stub con `debugPrint` — in un'app reale fermerebbero il suono della sveglia/la rinvierebbero.
- `lib/alarm_ring_screen.dart` — l'intera feature. `AlarmRingScreen` è uno `StatefulWidget` che riceve `alarmTitle`, `onDismissed` e `onSnoozed` come parametri e gestisce tutto lo stato della UI di sveglia/sblocco:
  - Enum `UnlockMode` (`swipe` | `mathPuzzle`) selezionabile tramite un `SegmentedButton` nell'header; il cambio modalità resetta lo stato dello swipe.
  - Modalità enigma matematico: `_generateMathPuzzle()` genera un'addizione casuale e 4 opzioni a scelta multipla mescolate (3 sbagliate, 1 corretta); `_checkAnswer()` chiama `widget.onDismissed()` se la risposta è corretta, oppure lampeggia in rosso e rigenera un nuovo enigma dopo un breve ritardo se è sbagliata.
  - Modalità swipe: un cerchio trascinabile gestito da `GestureDetector` (`_dragPosition`, limitato da `_maxDragWidth`) che chiama `widget.onDismissed()` una volta trascinato oltre l'85% del percorso, altrimenti torna a 0.
  - Un'animazione di pulsazione (`_pulseController`/`_pulseAnimation`) gira continuamente sull'orologio visualizzato.
  - Il pulsante "RINVIA (9 MIN)" (snooze) chiama sempre `widget.onSnoozed(9)`.

Poiché entrambi i flussi di sblocco e tutta la logica di visualizzazione risiedono in un unico widget/file, la maggior parte delle modifiche al comportamento della schermata sveglia richiede di modificare solo `lib/alarm_ring_screen.dart`.

## Test

`test/widget_test.dart` monta `AlarmDemoApp` con un viewport fisso e alto (480x900) — necessario perché il layout della schermata sveglia è pensato per schermi in formato telefono e va in overflow con la superficie di test predefinita — e verifica che il titolo della sveglia venga renderizzato. Segui lo stesso schema di impostazione del viewport per eventuali nuovi widget test di `AlarmRingScreen`.

## Convenzioni

- `applicationId`/`namespace` Android sono ancora il default del template `com.example.alarm_app` (vedi `android/app/build.gradle`) e le build di release sono firmate con il keystore di debug — entrambi sono marcati `TODO` nel file gradle e non ancora impostati per questo progetto demo.
- Vincolo Dart SDK: `>=3.0.0 <4.0.0` (vedi `pubspec.yaml`).
