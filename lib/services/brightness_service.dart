import 'package:screen_brightness/screen_brightness.dart';

import '../models/clock_settings.dart';

/// Applica davvero la luminosità dello schermo del telefono (non un finto
/// overlay), così l'orologio da comodino non abbaglia di notte.
class BrightnessService {
  static Future<void> apply(ClockBrightness level) async {
    try {
      await ScreenBrightness().setApplicationScreenBrightness(clockBrightnessValues[level]!);
    } catch (_) {
      // Alcuni dispositivi/emulatori non espongono il controllo luminosità:
      // ignoriamo silenziosamente, il resto dell'app resta utilizzabile.
    }
  }
}
