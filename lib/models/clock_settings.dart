import 'package:flutter/material.dart';

enum ClockBrightness { normal, medium, low }

enum ClockFaceStyle { digital, dots, segments, neon, minimal, flip }

const Map<ClockBrightness, double> clockBrightnessValues = {
  ClockBrightness.normal: 1.0,
  ClockBrightness.medium: 0.5,
  ClockBrightness.low: 0.12,
};

const Map<ClockBrightness, String> clockBrightnessLabels = {
  ClockBrightness.normal: 'Normale',
  ClockBrightness.medium: 'Media',
  ClockBrightness.low: 'Poco luminosa',
};

const Map<ClockFaceStyle, String> clockFaceStyleLabels = {
  ClockFaceStyle.digital: 'Android',
  ClockFaceStyle.dots: 'Pallini',
  ClockFaceStyle.segments: 'Linee',
  ClockFaceStyle.neon: 'Neon',
  ClockFaceStyle.minimal: 'Minimal',
  ClockFaceStyle.flip: 'Flip',
};

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
  ClockBrightness brightness;
  ClockFaceStyle clockFaceStyle;
  String fontChoice;
  double fontSizeScale;
  bool fontBold;
  int accentColorIndex;
  bool use24HourFormat;
  bool showSeconds;
  bool showDate;
  bool antiBurnInEnabled;
  double panelOpacity;
  double dotSpacingScale;
  double segmentThicknessScale;

  // Sveglia
  bool alarmEnabled;
  int alarmHour;
  int alarmMinute;
  Set<int> alarmRepeatWeekdays; // 1=lun .. 7=dom (DateTime.weekday)
  bool alarmUseRadioSound;
  String? alarmRadioStationUrl;

  ClockSettings({
    this.brightness = ClockBrightness.normal,
    this.clockFaceStyle = ClockFaceStyle.digital,
    this.fontChoice = 'Predefinito',
    this.fontSizeScale = 1.0,
    this.fontBold = true,
    this.accentColorIndex = 0,
    this.use24HourFormat = true,
    this.showSeconds = false,
    this.showDate = true,
    this.antiBurnInEnabled = true,
    this.panelOpacity = 0.35,
    this.dotSpacingScale = 1.0,
    this.segmentThicknessScale = 1.0,
    this.alarmEnabled = false,
    this.alarmHour = 7,
    this.alarmMinute = 0,
    Set<int>? alarmRepeatWeekdays,
    this.alarmUseRadioSound = false,
    this.alarmRadioStationUrl,
  }) : alarmRepeatWeekdays = alarmRepeatWeekdays ?? {1, 2, 3, 4, 5, 6, 7};

  Color get accentColor => accentPalette[accentColorIndex % accentPalette.length];

  String? get resolvedFontFamily => fontFamilyMap[fontChoice];

  double get brightnessValue => clockBrightnessValues[brightness]!;

  ClockBrightness get nextBrightness {
    switch (brightness) {
      case ClockBrightness.normal:
        return ClockBrightness.medium;
      case ClockBrightness.medium:
        return ClockBrightness.low;
      case ClockBrightness.low:
        return ClockBrightness.normal;
    }
  }

  void update(void Function() mutation) {
    mutation();
    notifyListeners();
  }

  Map<String, dynamic> toJson() => {
        'brightness': brightness.index,
        'clockFaceStyle': clockFaceStyle.index,
        'fontChoice': fontChoice,
        'fontSizeScale': fontSizeScale,
        'fontBold': fontBold,
        'accentColorIndex': accentColorIndex,
        'use24HourFormat': use24HourFormat,
        'showSeconds': showSeconds,
        'showDate': showDate,
        'antiBurnInEnabled': antiBurnInEnabled,
        'panelOpacity': panelOpacity,
        'dotSpacingScale': dotSpacingScale,
        'segmentThicknessScale': segmentThicknessScale,
        'alarmEnabled': alarmEnabled,
        'alarmHour': alarmHour,
        'alarmMinute': alarmMinute,
        'alarmRepeatWeekdays': alarmRepeatWeekdays.toList(),
        'alarmUseRadioSound': alarmUseRadioSound,
        'alarmRadioStationUrl': alarmRadioStationUrl,
      };

  static ClockSettings fromJson(Map<String, dynamic> json) {
    return ClockSettings(
      brightness: ClockBrightness.values[json['brightness'] as int? ?? 0],
      clockFaceStyle: ClockFaceStyle.values[(json['clockFaceStyle'] as int? ?? 0)
          .clamp(0, ClockFaceStyle.values.length - 1)],
      fontChoice: json['fontChoice'] as String? ?? 'Predefinito',
      fontSizeScale: (json['fontSizeScale'] as num?)?.toDouble() ?? 1.0,
      fontBold: json['fontBold'] as bool? ?? true,
      accentColorIndex: json['accentColorIndex'] as int? ?? 0,
      use24HourFormat: json['use24HourFormat'] as bool? ?? true,
      showSeconds: json['showSeconds'] as bool? ?? false,
      showDate: json['showDate'] as bool? ?? true,
      antiBurnInEnabled: json['antiBurnInEnabled'] as bool? ?? true,
      panelOpacity: (json['panelOpacity'] as num?)?.toDouble() ?? 0.35,
      dotSpacingScale: (json['dotSpacingScale'] as num?)?.toDouble() ?? 1.0,
      segmentThicknessScale: (json['segmentThicknessScale'] as num?)?.toDouble() ?? 1.0,
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
