import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/clock_settings.dart';

/// Controlla periodicamente se è ora di suonare la sveglia.
///
/// Funziona finché l'app resta in primo piano (uso previsto: telefono
/// dedicato come orologio da comodino, sempre acceso e con l'app aperta).
class AlarmCheckerService extends ChangeNotifier {
  final ClockSettings settings;
  Timer? _timer;
  bool isRinging = false;
  DateTime? _lastTriggeredMinute;
  DateTime? _snoozeUntil;

  AlarmCheckerService(this.settings) {
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _check());
  }

  void _check() {
    if (isRinging) return;
    final now = DateTime.now();

    if (_snoozeUntil != null && !now.isBefore(_snoozeUntil!)) {
      _snoozeUntil = null;
      isRinging = true;
      notifyListeners();
      return;
    }

    if (!settings.alarmEnabled) return;

    final matchesTime =
        now.hour == settings.alarmHour && now.minute == settings.alarmMinute;
    final matchesDay = settings.alarmRepeatWeekdays.contains(now.weekday);
    final currentMinuteKey =
        DateTime(now.year, now.month, now.day, now.hour, now.minute);

    if (matchesTime && matchesDay && _lastTriggeredMinute != currentMinuteKey) {
      _lastTriggeredMinute = currentMinuteKey;
      isRinging = true;
      notifyListeners();
    }
  }

  void dismiss() {
    isRinging = false;
    _snoozeUntil = null;
    notifyListeners();
  }

  void snooze(int minutes) {
    isRinging = false;
    _snoozeUntil = DateTime.now().add(Duration(minutes: minutes));
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
