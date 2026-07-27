import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:bedside_clock/models/clock_settings.dart';
import 'package:bedside_clock/screens/clock_screen.dart';
import 'package:bedside_clock/services/alarm_checker_service.dart';
import 'package:bedside_clock/services/radio_player_service.dart';

void main() {
  testWidgets('BedsideClockApp shows the clock and settings button', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(480, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final settings = ClockSettings();
    final radioService = RadioPlayerService();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ClockSettings>.value(value: settings),
          ChangeNotifierProvider<RadioPlayerService>.value(value: radioService),
          ChangeNotifierProvider<AlarmCheckerService>(
            create: (_) => AlarmCheckerService(settings),
          ),
        ],
        child: MaterialApp(
          theme: ThemeData.dark(useMaterial3: true),
          home: const ClockScreen(),
        ),
      ),
    );
    await tester.pump();

    expect(find.byIcon(Icons.settings), findsOneWidget);

    // Smonta l'albero per fermare i Timer periodici (ticker orologio,
    // controllo sveglia) prima che il test termini.
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
