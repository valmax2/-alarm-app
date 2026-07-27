import 'package:flutter/material.dart';

/// Font a matrice di punti 5x7 per cifre e ':'.
/// Ogni riga è una stringa di 5 caratteri: '#' = punto acceso, '.' = spento.
const Map<String, List<String>> _dotFont = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
};

class DotMatrixClockFace extends StatelessWidget {
  final String timeText;
  final Color color;
  final double fontSize;

  const DotMatrixClockFace({
    super.key,
    required this.timeText,
    required this.color,
    required this.fontSize,
  });

  @override
  Widget build(BuildContext context) {
    // fontSize funge da altezza di riferimento del quadrante.
    final dotPitch = fontSize / 11;
    final width = timeText.length * (5 * dotPitch + dotPitch * 1.5);
    final height = 7 * dotPitch;

    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: _DotMatrixPainter(text: timeText, color: color, dotPitch: dotPitch),
      ),
    );
  }
}

class _DotMatrixPainter extends CustomPainter {
  final String text;
  final Color color;
  final double dotPitch;

  _DotMatrixPainter({required this.text, required this.color, required this.dotPitch});

  @override
  void paint(Canvas canvas, Size size) {
    final onPaint = Paint()..color = color;
    final offPaint = Paint()..color = color.withValues(alpha: 0.08);
    final dotRadius = dotPitch * 0.38;
    final charAdvance = 5 * dotPitch + dotPitch * 1.5;

    for (int c = 0; c < text.length; c++) {
      final pattern = _dotFont[text[c]] ?? _dotFont[':']!;
      final xOffset = c * charAdvance;
      for (int row = 0; row < pattern.length; row++) {
        for (int col = 0; col < pattern[row].length; col++) {
          final isOn = pattern[row][col] == '#';
          final cx = xOffset + col * dotPitch + dotPitch / 2;
          final cy = row * dotPitch + dotPitch / 2;
          canvas.drawCircle(Offset(cx, cy), dotRadius, isOn ? onPaint : offPaint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DotMatrixPainter oldDelegate) {
    return oldDelegate.text != text || oldDelegate.color != color || oldDelegate.dotPitch != dotPitch;
  }
}
