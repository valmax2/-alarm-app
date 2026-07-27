import 'package:flutter/material.dart';

/// Stile "Android": semplice testo digitale con il font/colore scelti
/// dall'utente nelle impostazioni.
class DigitalClockFace extends StatelessWidget {
  final String timeText;
  final Color color;
  final String? fontFamily;
  final FontWeight fontWeight;
  final double fontSize;

  const DigitalClockFace({
    super.key,
    required this.timeText,
    required this.color,
    required this.fontFamily,
    required this.fontWeight,
    required this.fontSize,
  });

  @override
  Widget build(BuildContext context) {
    return Text(
      timeText,
      style: TextStyle(
        fontFamily: fontFamily,
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: 2.0,
        shadows: [
          Shadow(color: color.withValues(alpha: 0.55), blurRadius: 30),
        ],
      ),
    );
  }
}
