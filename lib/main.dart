import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'models/clock_settings.dart';
import 'screens/clock_screen.dart';
import 'services/alarm_checker_service.dart';
import 'services/radio_player_service.dart';
import 'services/settings_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final settings = await SettingsRepository.loadSettings();
  settings.addListener(() {
    SettingsRepository.saveSettings(settings);
  });

  final radioService = RadioPlayerService();
  await radioService.init();

  runApp(BedsideClockApp(settings: settings, radioService: radioService));
}

class BedsideClockApp extends StatelessWidget {
  final ClockSettings settings;
  final RadioPlayerService radioService;

  const BedsideClockApp({
    super.key,
    required this.settings,
    required this.radioService,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<ClockSettings>.value(value: settings),
        ChangeNotifierProvider<RadioPlayerService>.value(value: radioService),
        ChangeNotifierProvider<AlarmCheckerService>(
          create: (_) => AlarmCheckerService(settings),
        ),
      ],
      child: MaterialApp(
        title: 'Orologio Radio',
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark(useMaterial3: true),
        home: const ClockScreen(),
      ),
    );
  }
}
