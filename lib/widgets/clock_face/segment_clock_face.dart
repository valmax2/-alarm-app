import 'package:flutter/material.dart';

/// Segmenti accesi per cifra, ordine: a (alto), b (alto-dx), c (basso-dx),
/// d (basso), e (basso-sx), f (alto-sx), g (centrale).
const Map<String, List<bool>> _segmentMap = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
  ':': [false, false, false, false, false, false, false],
};

class SegmentClockFace extends StatelessWidget {
  final String timeText;
  final Color color;
  final double fontSize;
  final double thicknessScale;

  const SegmentClockFace({
    super.key,
    required this.timeText,
    required this.color,
    required this.fontSize,
    this.thicknessScale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    final digitHeight = fontSize;
    final digitWidth = digitHeight * 0.5;
    final spacing = digitHeight * 0.12;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (int i = 0; i < timeText.length; i++) ...[
          if (timeText[i] == ':')
            SizedBox(
              width: digitWidth * 0.35,
              height: digitHeight,
              child: CustomPaint(
                painter: _ColonPainter(color: color),
              ),
            )
          else
            SizedBox(
              width: digitWidth,
              height: digitHeight,
              child: CustomPaint(
                painter: _SegmentPainter(
                  segments: _segmentMap[timeText[i]] ?? _segmentMap['0']!,
                  color: color,
                  thickness: digitHeight * 0.09 * thicknessScale,
                ),
              ),
            ),
          if (i != timeText.length - 1) SizedBox(width: spacing),
        ],
      ],
    );
  }
}

class _SegmentPainter extends CustomPainter {
  final List<bool> segments;
  final Color color;
  final double thickness;

  _SegmentPainter({required this.segments, required this.color, required this.thickness});

  @override
  void paint(Canvas canvas, Size size) {
    final onPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final offPaint = Paint()
      ..color = color.withValues(alpha: 0.08)
      ..style = PaintingStyle.fill;

    final w = size.width;
    final h = size.height;
    final t = thickness;
    final midY = h / 2;

    Path hSegment(double y) {
      return Path()
        ..moveTo(t * 0.6, y)
        ..lineTo(t * 1.2, y - t / 2)
        ..lineTo(w - t * 1.2, y - t / 2)
        ..lineTo(w - t * 0.6, y)
        ..lineTo(w - t * 1.2, y + t / 2)
        ..lineTo(t * 1.2, y + t / 2)
        ..close();
    }

    Path vSegment(double x, double yTop, double yBottom) {
      return Path()
        ..moveTo(x, yTop + t * 0.6)
        ..lineTo(x + t / 2, yTop + t * 1.2)
        ..lineTo(x + t / 2, yBottom - t * 1.2)
        ..lineTo(x, yBottom - t * 0.6)
        ..lineTo(x - t / 2, yBottom - t * 1.2)
        ..lineTo(x - t / 2, yTop + t * 1.2)
        ..close();
    }

    final paths = <Path>[
      hSegment(0), // a
      vSegment(w, 0, midY), // b
      vSegment(w, midY, h), // c
      hSegment(h), // d
      vSegment(0, midY, h), // e
      vSegment(0, 0, midY), // f
      hSegment(midY), // g
    ];

    for (int i = 0; i < paths.length; i++) {
      canvas.drawPath(paths[i], segments[i] ? onPaint : offPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _SegmentPainter oldDelegate) {
    return oldDelegate.segments != segments || oldDelegate.color != color;
  }
}

class _ColonPainter extends CustomPainter {
  final Color color;
  _ColonPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final radius = size.width * 0.4;
    canvas.drawCircle(Offset(size.width / 2, size.height * 0.35), radius, paint);
    canvas.drawCircle(Offset(size.width / 2, size.height * 0.65), radius, paint);
  }

  @override
  bool shouldRepaint(covariant _ColonPainter oldDelegate) => oldDelegate.color != color;
}
