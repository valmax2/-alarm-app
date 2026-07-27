import 'package:flutter/material.dart';

import '../../models/clock_settings.dart';
import 'digital_clock_face.dart';
import 'dot_matrix_clock_face.dart';
import 'flip_clock_face.dart';
import 'minimal_clock_face.dart';
import 'neon_clock_face.dart';
import 'segment_clock_face.dart';

/// Sceglie il widget giusto in base allo stile del quadrante impostato.
class ClockFace extends StatelessWidget {
  final ClockFaceStyle style;
  final String timeText;
  final Color color;
  final String? fontFamily;
  final FontWeight fontWeight;
  final double fontSize;
  final double dotSpacingScale;
  final double segmentThicknessScale;

  const ClockFace({
    super.key,
    required this.style,
    required this.timeText,
    required this.color,
    required this.fontFamily,
    required this.fontWeight,
    required this.fontSize,
    this.dotSpacingScale = 1.0,
    this.segmentThicknessScale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    switch (style) {
      case ClockFaceStyle.digital:
        return DigitalClockFace(
          timeText: timeText,
          color: color,
          fontFamily: fontFamily,
          fontWeight: fontWeight,
          fontSize: fontSize,
        );
      case ClockFaceStyle.dots:
        return DotMatrixClockFace(
          timeText: timeText,
          color: color,
          fontSize: fontSize,
          spacingScale: dotSpacingScale,
        );
      case ClockFaceStyle.segments:
        return SegmentClockFace(
          timeText: timeText,
          color: color,
          fontSize: fontSize,
          thicknessScale: segmentThicknessScale,
        );
      case ClockFaceStyle.neon:
        return NeonClockFace(
          timeText: timeText,
          color: color,
          fontFamily: fontFamily,
          fontSize: fontSize,
        );
      case ClockFaceStyle.minimal:
        return MinimalClockFace(
          timeText: timeText,
          color: color,
          fontFamily: fontFamily,
          fontSize: fontSize,
        );
      case ClockFaceStyle.flip:
        return FlipClockFace(
          timeText: timeText,
          color: color,
          fontSize: fontSize,
        );
    }
  }
}
