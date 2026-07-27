import 'package:flutter/material.dart';

enum DayNightMode { day, night, auto }

enum ClockFaceStyle { digital, dots, segments }

/// Palette di colori d'accento selezionabili per testo/pulsanti.
const List<Color> accentPalette = [
  Color(0xFFFF5252), // rosso
  Color(0xFFFFB300), // ambra
  Color(0xFF00E5A8), // verde acqua
  Color(0xFF29B6F6), // azzurro
  Color(0xFF7C4DFF), // viola
  Color(0xFFFF4081), // rosa
  Color(0xFFFFFFFF), // bianco
];

const List<String> fontChoices = [
  'Predefinito',
  'Monospace',
  'Serif',
  'Condensato',
];

const Map<String, String?> fontFamilyMap = {
  'Predefinito': null,
  'Monospace': 'monospace',
  'Serif': 'serif',
  'Condensato': 'sans-serif-condensed',
};

class ClockSettings extends ChangeNotifier {
  DayNightMode dayNightMode;
  ClockFaceStyle clockFaceStyle;
  String fontChoice;
  double fontSizeScale;
  bool fontBold;
  int accentColorIndex;
  bool use24HourFormat;
  bool showSeconds;
  bool showDate;
  bool antiBurnInEnabled;

  // Sveglia
  bool alarmEnabled;
  int alarmHour;
  int alarmMinute;
  Set<int> alarmRepeatWeekdays; // 1=lun .. 7=dom (DateTime.weekday)
  bool alarmUseRadioSound;
  String? alarmRadioStationUrl;

  ClockSettings({
    this.dayNightMode = DayNightMode.night,
    this.clockFaceStyle = ClockFaceStyle.digital,
    this.fontChoice = 'Predefinito',
    this.fontSizeScale = 1.0,
    this.fontBold = true,
    this.accentColorIndex = 0,
    this.use24HourFormat = true,
    this.showSeconds = false,
    this.showDate = true,
    this.antiBurnInEnabled = true,
    this.alarmEnabled = false,
    this.alarmHour = 7,
    this.alarmMinute = 0,
    Set<int>? alarmRepeatWeekdays,
    this.alarmUseRadioSound = false,
    this.alarmRadioStationUrl,
  }) : alarmRepeatWeekdays = alarmRepeatWeekdays ?? {1, 2, 3, 4, 5, 6, 7};

  Color get accentColor => accentPalette[accentColorIndex % accentPalette.length];

  String? get resolvedFontFamily => fontFamilyMap[fontChoice];

  bool get isNight {
    switch (dayNightMode) {
      case DayNightMode.day:
        return false;
      case DayNightMode.night:
        return true;
      case DayNightMode.auto:
        final hour = DateTime.now().hour;
        return hour >= 20 || hour < 7;
    }
  }

  void update(void Function() mutation) {
    mutation();
    notifyListeners();
  }

  Map<String, dynamic> toJson() => {
        'dayNightMode': dayNightMode.index,
        'clockFaceStyle': clockFaceStyle.index,
        'fontChoice': fontChoice,
        'fontSizeScale': fontSizeScale,
        'fontBold': fontBold,
        'accentColorIndex': accentColorIndex,
        'use24HourFormat': use24HourFormat,
        'showSeconds': showSeconds,
        'showDate': showDate,
        'antiBurnInEnabled': antiBurnInEnabled,
        'alarmEnabled': alarmEnabled,
        'alarmHour': alarmHour,
        'alarmMinute': alarmMinute,
        'alarmRepeatWeekdays': alarmRepeatWeekdays.toList(),
        'alarmUseRadioSound': alarmUseRadioSound,
        'alarmRadioStationUrl': alarmRadioStationUrl,
      };

  static ClockSettings fromJson(Map<String, dynamic> json) {
    return ClockSettings(
      dayNightMode: DayNightMode.values[json['dayNightMode'] as int? ?? 1],
      clockFaceStyle: ClockFaceStyle.values[json['clockFaceStyle'] as int? ?? 0],
      fontChoice: json['fontChoice'] as String? ?? 'Predefinito',
      fontSizeScale: (json['fontSizeScale'] as num?)?.toDouble() ?? 1.0,
      fontBold: json['fontBold'] as bool? ?? true,
      accentColorIndex: json['accentColorIndex'] as int? ?? 0,
      use24HourFormat: json['use24HourFormat'] as bool? ?? true,
      showSeconds: json['showSeconds'] as bool? ?? false,
      showDate: json['showDate'] as bool? ?? true,
      antiBurnInEnabled: json['antiBurnInEnabled'] as bool? ?? true,
      alarmEnabled: json['alarmEnabled'] as bool? ?? false,
      alarmHour: json['alarmHour'] as int? ?? 7,
      alarmMinute: json['alarmMinute'] as int? ?? 0,
      alarmRepeatWeekdays: (json['alarmRepeatWeekdays'] as List<dynamic>?)
              ?.map((e) => e as int)
              .toSet() ??
          {1, 2, 3, 4, 5, 6, 7},
      alarmUseRadioSound: json['alarmUseRadioSound'] as bool? ?? false,
      alarmRadioStationUrl: json['alarmRadioStationUrl'] as String?,
    );
  }
}
