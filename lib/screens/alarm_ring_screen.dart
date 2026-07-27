import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/clock_settings.dart';
import '../models/radio_station.dart';
import '../services/alarm_checker_service.dart';
import '../services/radio_player_service.dart';
import '../widgets/gradient_button.dart';

class AlarmRingScreen extends StatefulWidget {
  const AlarmRingScreen({super.key});

  @override
  State<AlarmRingScreen> createState() => _AlarmRingScreenState();
}

class _AlarmRingScreenState extends State<AlarmRingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) => _startAlarmSound());
  }

  void _startAlarmSound() {
    final settings = context.read<ClockSettings>();
    final radio = context.read<RadioPlayerService>();

    if (settings.alarmUseRadioSound && settings.alarmRadioStationUrl != null) {
      radio.playUrl(settings.alarmRadioStationUrl!, name: 'Sveglia');
    } else if (radio.currentStation == null) {
      radio.play(presetRadioStations.first);
    } else if (!radio.isPlaying) {
      radio.resume();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _dismiss() {
    context.read<AlarmCheckerService>().dismiss();
    context.read<RadioPlayerService>().stop();
    Navigator.of(context).pop();
  }

  void _snooze() {
    context.read<AlarmCheckerService>().snooze(9);
    context.read<RadioPlayerService>().stop();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<ClockSettings>();
    final now = DateTime.now();
    final timeStr = settings.use24HourFormat
        ? "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}"
        : _format12h(now);

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0D0D11),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  children: [
                    const Icon(Icons.alarm, color: Colors.redAccent, size: 40),
                    const SizedBox(height: 8),
                    const Text(
                      'SVEGLIA',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 3,
                      ),
                    ),
                  ],
                ),
                ScaleTransition(
                  scale: _pulseAnimation,
                  child: Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 84,
                      fontWeight: FontWeight.bold,
                      color: settings.accentColor,
                    ),
                  ),
                ),
                Column(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      child: GradientButton(
                        label: 'SPEGNI',
                        icon: Icons.alarm_off,
                        color: settings.accentColor,
                        height: 64,
                        fontSize: 18,
                        onPressed: _dismiss,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: GradientButton(
                        label: 'RINVIA (9 MIN)',
                        icon: Icons.snooze,
                        color: Colors.amber.shade700,
                        height: 56,
                        fontSize: 15,
                        onPressed: _snooze,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _format12h(DateTime now) {
    final hour12 = now.hour % 12 == 0 ? 12 : now.hour % 12;
    final suffix = now.hour < 12 ? 'AM' : 'PM';
    return "${hour12.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} $suffix";
  }
}
