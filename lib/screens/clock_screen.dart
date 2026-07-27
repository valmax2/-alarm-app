import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/clock_settings.dart';
import '../services/alarm_checker_service.dart';
import '../widgets/burn_in_protector.dart';
import '../widgets/clock_face/clock_face.dart';
import '../widgets/gradient_button.dart';
import '../widgets/radio_control_bar.dart';
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

class _ClockScreenState extends State<ClockScreen> {
  Timer? _ticker;
  DateTime _now = DateTime.now();
  bool _ringScreenOpen = false;
  AlarmCheckerService? _alarmChecker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _now = DateTime.now());
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _alarmChecker = context.read<AlarmCheckerService>();
      _alarmChecker!.addListener(_onAlarmStateChanged);
    });
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
    _alarmChecker?.removeListener(_onAlarmStateChanged);
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
    final isNight = settings.isNight;
    final backgroundColor = isNight ? const Color(0xFF0A0A0F) : const Color(0xFFF2F3F7);
    final textColor = isNight ? settings.accentColor : settings.accentColor.withValues(alpha: 0.9);
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
                        Icon(Icons.alarm, size: 16, color: isNight ? Colors.white54 : Colors.black45),
                        const SizedBox(width: 6),
                        Text(
                          'Sveglia ${settings.alarmHour.toString().padLeft(2, '0')}:${settings.alarmMinute.toString().padLeft(2, '0')}',
                          style: TextStyle(
                            color: isNight ? Colors.white54 : Colors.black45,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    )
                  else
                    const SizedBox.shrink(),
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
                      ),
                      if (settings.showDate) ...[
                        const SizedBox(height: 12),
                        Text(
                          _buildDateText(),
                          style: TextStyle(
                            color: isNight ? Colors.white54 : Colors.black45,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const RadioControlBar(),
            ],
          ),
        ),
      ),
    );
  }
}
