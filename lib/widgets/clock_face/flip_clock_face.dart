import 'package:flutter/material.dart';

/// Stile "flip clock" classico: ogni cifra su una tessera con una linea
/// di piega al centro, come i vecchi orologi a schede meccaniche.
class FlipClockFace extends StatelessWidget {
  final String timeText;
  final Color color;
  final double fontSize;

  const FlipClockFace({
    super.key,
    required this.timeText,
    required this.color,
    required this.fontSize,
  });

  @override
  Widget build(BuildContext context) {
    final cardHeight = fontSize * 1.15;
    final cardWidth = fontSize * 0.78;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (int i = 0; i < timeText.length; i++)
          if (timeText[i] == ':')
            SizedBox(
              width: fontSize * 0.22,
              height: cardHeight,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: fontSize * 0.09,
                    height: fontSize * 0.09,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  SizedBox(height: fontSize * 0.14),
                  Container(
                    width: fontSize * 0.09,
                    height: fontSize * 0.09,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                ],
              ),
            )
          else
            Container(
              width: cardWidth,
              height: cardHeight,
              margin: EdgeInsets.symmetric(horizontal: fontSize * 0.025),
              decoration: BoxDecoration(
                color: const Color(0xFF1C1C24),
                borderRadius: BorderRadius.circular(fontSize * 0.08),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Text(
                    timeText[i],
                    style: TextStyle(
                      color: color,
                      fontSize: fontSize * 0.7,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    top: cardHeight / 2 - 0.75,
                    child: Container(
                      height: 1.5,
                      color: Colors.black.withValues(alpha: 0.55),
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}
