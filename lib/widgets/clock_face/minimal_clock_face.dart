import 'package:flutter/material.dart';

/// Stile essenziale: font sottile, molto spazio tra le lettere,
/// nessun bagliore. Discreto e elegante.
class MinimalClockFace extends StatelessWidget {
  final String timeText;
  final Color color;
  final String? fontFamily;
  final double fontSize;

  const MinimalClockFace({
    super.key,
    required this.timeText,
    required this.color,
    required this.fontFamily,
    required this.fontSize,
  });

  @override
  Widget build(BuildContext context) {
    return Text(
      timeText,
      style: TextStyle(
        fontFamily: fontFamily,
        fontSize: fontSize * 0.88,
        fontWeight: FontWeight.w200,
        color: color,
        letterSpacing: 6,
      ),
    );
  }
}
