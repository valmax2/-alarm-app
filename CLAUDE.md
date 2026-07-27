# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`alarm_app` ("Sveglia Demo" / bedside-clock-apk) is a Flutter demo app for an alarm-clock ring screen with two unlock modes: solving a math puzzle or a swipe-to-unlock gesture. Android is the only configured platform (no `ios/`, `web/`, etc. directories exist). UI strings and code comments are written in Italian.

## Commands

```bash
flutter pub get              # install dependencies
flutter analyze              # static analysis / lint (flutter_lints via analysis_options.yaml)
flutter test                 # run all tests
flutter test test/widget_test.dart                    # run a single test file
flutter test --plain-name "AlarmDemoApp shows the alarm ring screen"  # run a single test by name
flutter run                  # run the app on a connected device/emulator
flutter build apk --release  # build the release APK (same command CI uses)
```

CI (`.github/workflows/build_apk.yml`) runs on pushes to `main`/`master`: `flutter pub get` then `flutter build apk --release`, uploading `build/app/outputs/flutter-apk/app-release.apk` as artifact `bedside-clock-apk`. There is no separate lint/test CI job — `flutter analyze` and `flutter test` should be run locally before pushing.

## Architecture

The app is intentionally small, with all Dart source under `lib/`:

- `lib/main.dart` — entry point. `AlarmDemoApp` is a `MaterialApp` (dark theme) whose `home` is directly an `AlarmRingScreen`; there is no routing/navigation stack. The `onDismissed`/`onSnoozed` callbacks passed here are just `debugPrint` stubs — in a real app these would stop the alarm sound/reschedule it.
- `lib/alarm_ring_screen.dart` — the entire feature. `AlarmRingScreen` is a `StatefulWidget` that takes `alarmTitle`, `onDismissed`, and `onSnoozed` as inputs and owns all state for the ring/unlock UI:
  - `UnlockMode` enum (`swipe` | `mathPuzzle`) toggled via a `SegmentedButton` in the header; switching modes resets swipe drag state.
  - Math puzzle mode: `_generateMathPuzzle()` generates a random addition problem and 4 shuffled multiple-choice options (3 wrong, 1 correct); `_checkAnswer()` calls `widget.onDismissed()` on a correct pick, or flashes red and regenerates a new puzzle after a delay on a wrong pick.
  - Swipe mode: a `GestureDetector`-driven draggable circle (`_dragPosition`, bounded by `_maxDragWidth`) that calls `widget.onDismissed()` once dragged past 85% of the track, otherwise springs back to 0.
  - A pulsing scale animation (`_pulseController`/`_pulseAnimation`) runs continuously on the clock display.
  - A "RINVIA (9 MIN)" (snooze) button always calls `widget.onSnoozed(9)`.

Since both unlock flows and all display logic live in one widget/file, most changes to alarm-screen behavior only require editing `lib/alarm_ring_screen.dart`.

## Tests

`test/widget_test.dart` pumps `AlarmDemoApp` at a fixed tall viewport (480x900) — required because the ring screen layout is designed for phone-sized screens and overflows on the default test surface — and asserts the alarm title renders. Follow this same viewport-setup pattern for any new widget tests of `AlarmRingScreen`.

## Conventions

- Android `applicationId`/`namespace` is still the template default `com.example.alarm_app` (see `android/app/build.gradle`) and release builds are signed with the debug keystore — both are marked `TODO` in the gradle file and unset for this demo project.
- Dart SDK constraint: `>=3.0.0 <4.0.0` (see `pubspec.yaml`).
