import 'package:flutter/material.dart';
import 'alarm_ring_screen.dart';

void main() {
  runApp(const AlarmDemoApp());
}

class AlarmDemoApp extends StatelessWidget {
  const AlarmDemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sveglia Demo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: AlarmRingScreen(
        alarmTitle: 'Sveglia Mattutina',
        onDismissed: () {
          // Qui in un'app reale fermeresti il suono della sveglia
          debugPrint('Sveglia spenta!');
        },
        onSnoozed: (minutes) {
          // Qui in un'app reale rimanderesti la sveglia di N minuti
          debugPrint('Sveglia rinviata di $minutes minuti');
        },
      ),
    );
  }
}
