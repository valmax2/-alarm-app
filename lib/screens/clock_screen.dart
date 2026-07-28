import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../models/clock_settings.dart';
import '../services/alarm_checker_service.dart';
import '../services/brightness_service.dart';
import '../widgets/burn_in_protector.dart';
import '../widgets/clock_face/clock_face.dart';
import '../widgets/collapsible_radio_bar.dart';
import '../widgets/gradient_button.dart';
import 'alarm_ring_screen.dart';
import 'settings_screen.dart';

const List<String> _weekdayNamesIt = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
];

const List<String> _monthNamesIt = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

class ClockScreen extends StatefulWidget {
  const ClockScreen({super.key});

  @override
  State<ClockScreen> createState() => _ClockScreenState();
}

// Dopo tanto tempo alla massima luminosità, l'orologio si autoattenua un
// gradino per limitare il riscaldamento dello schermo (protezione
// anti-surriscaldamento "software": niente sensore di temperatura, ma
// evita di tenere il backlight al massimo per ore di fila).
const Duration _overheatProtectionDelay = Duration(minutes: 30);

class _ClockScreenState extends State<ClockScreen> {
  Timer? _ticker;
  Timer? _overheatTimer;
  DateTime _now = DateTime.now();
  bool _ringScreenOpen = false;
  AlarmCheckerService? _alarmChecker;
  ClockSettings? _settingsRef;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _now = DateTime.now());
    });

    // Orologio da comodino: lo schermo non deve mai spegnersi da solo
    // finché l'app resta aperta.
    WakelockPlus.enable();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _alarmChecker = context.read<AlarmCheckerService>();
      _alarmChecker!.addListener(_onAlarmStateChanged);
      _settingsRef = context.read<ClockSettings>();
      _settingsRef!.addListener(_onSettingsChanged);
      BrightnessService.apply(_settingsRef!.brightness);
      _onSettingsChanged();
    });
  }

  void _cycleBrightness(ClockSettings settings) {
    final next = settings.nextBrightness;
    settings.update(() => settings.brightness = next);
    BrightnessService.apply(next);
  }

  void _onSettingsChanged() {
    final settings = _settingsRef;
    if (settings == null) return;
    if (settings.brightness == ClockBrightness.normal) {
      _overheatTimer ??= Timer(_overheatProtectionDelay, _applyOverheatProtection);
    } else {
      _overheatTimer?.cancel();
      _overheatTimer = null;
    }
  }

  void _applyOverheatProtection() {
    _overheatTimer = null;
    final settings = _settingsRef;
    if (!mounted || settings == null) return;
    settings.update(() => settings.brightness = ClockBrightness.medium);
    BrightnessService.apply(ClockBrightness.medium);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Luminosità ridotta automaticamente per evitare che lo schermo si surriscaldi.'),
        duration: Duration(seconds: 4),
      ),
    );
  }

  void _onAlarmStateChanged() {
    final checker = _alarmChecker;
    if (checker != null && checker.isRinging && !_ringScreenOpen) {
      _ringScreenOpen = true;
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => const AlarmRingScreen()))
          .then((_) => _ringScreenOpen = false);
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _overheatTimer?.cancel();
    _alarmChecker?.removeListener(_onAlarmStateChanged);
    _settingsRef?.removeListener(_onSettingsChanged);
    WakelockPlus.disable();
    super.dispose();
  }

  String _buildTimeText(ClockSettings settings) {
    int hour = _now.hour;
    if (!settings.use24HourFormat) {
      hour = hour % 12 == 0 ? 12 : hour % 12;
    }
    final h = hour.toString().padLeft(2, '0');
    final m = _now.minute.toString().padLeft(2, '0');
    if (settings.showSeconds) {
      final s = _now.second.toString().padLeft(2, '0');
      return '$h:$m:$s';
    }
    return '$h:$m';
  }

  String _buildDateText() {
    final weekday = _weekdayNamesIt[_now.weekday - 1];
    final month = _monthNamesIt[_now.month - 1];
    return '$weekday ${_now.day} $month';
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<ClockSettings>();
    const backgroundColor = Color(0xFF0A0A0F);
    final textColor = settings.accentColor;
    final baseFontSize = 96.0 * settings.fontSizeScale;

    return Scaffold(
      backgroundColor: backgroundColor,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (settings.alarmEnabled)
                    Row(
                      children: [
                        const Icon(Icons.alarm, size: 16, color: Colors.white54),
                        const SizedBox(width: 6),
                        Text(
                          'Sveglia ${settings.alarmHour.toString().padLeft(2, '0')}:${settings.alarmMinute.toString().padLeft(2, '0')}',
                          style: const TextStyle(color: Colors.white54, fontSize: 13),
                        ),
                      ],
                    )
                  else
                    const SizedBox.shrink(),
                  Row(
                    children: [
                      GradientIconButton(
                        icon: switch (settings.brightness) {
                          ClockBrightness.normal => Icons.brightness_high,
                          ClockBrightness.medium => Icons.brightness_medium,
                          ClockBrightness.low => Icons.brightness_low,
                        },
                        color: Colors.white24,
                        size: 40,
                        onPressed: () => _cycleBrightness(settings),
                      ),
                      const SizedBox(width: 10),
                      GradientIconButton(
                        icon: Icons.settings,
                        color: settings.accentColor,
                        size: 44,
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const SettingsScreen()),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Expanded(
                child: BurnInProtector(
                  enabled: settings.antiBurnInEnabled,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ClockFace(
                        style: settings.clockFaceStyle,
                        timeText: _buildTimeText(settings),
                        color: textColor,
                        fontFamily: settings.resolvedFontFamily,
                        fontWeight: settings.fontBold ? FontWeight.bold : FontWeight.normal,
                        fontSize: baseFontSize,
                        dotSpacingScale: settings.dotSpacingScale,
                        segmentThicknessScale: settings.segmentThicknessScale,
                      ),
                      if (settings.showDate) ...[
                        const SizedBox(height: 12),
                        Text(
                          _buildDateText(),
                          style: const TextStyle(color: Colors.white54, fontSize: 16),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const CollapsibleRadioBar(),
            ],
          ),
        ),
      ),
    );
  }
}
