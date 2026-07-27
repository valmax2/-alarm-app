import 'package:flutter/material.dart';

/// Stile "insegna al neon": testo bianco con più strati di bagliore
/// colorato, sempre leggibile a qualunque colore d'accento scelto.
class NeonClockFace extends StatelessWidget {
  final String timeText;
  final Color color;
  final String? fontFamily;
  final double fontSize;

  const NeonClockFace({
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
        fontSize: fontSize,
        fontWeight: FontWeight.w900,
        color: Colors.white,
        letterSpacing: 3,
        shadows: [
          Shadow(color: color, blurRadius: 6),
          Shadow(color: color, blurRadius: 16),
          Shadow(color: color.withValues(alpha: 0.85), blurRadius: 32),
          Shadow(color: color.withValues(alpha: 0.6), blurRadius: 56),
        ],
      ),
    );
  }
}
