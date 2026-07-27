import 'package:flutter/material.dart';

/// Pulsante con effetto 3D rialzato: gradiente + ombre per dare
/// l'impressione di un tasto fisico premibile.
class GradientButton extends StatelessWidget {
  final IconData? icon;
  final String label;
  final Color color;
  final VoidCallback? onPressed;
  final double height;
  final double fontSize;

  const GradientButton({
    super.key,
    required this.label,
    required this.color,
    this.icon,
    this.onPressed,
    this.height = 56,
    this.fontSize = 16,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    final baseColor = disabled ? color.withValues(alpha: 0.35) : color;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onPressed,
        child: Ink(
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color.lerp(baseColor, Colors.white, 0.25)!,
                baseColor,
                Color.lerp(baseColor, Colors.black, 0.25)!,
              ],
            ),
            boxShadow: disabled
                ? []
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.45),
                      offset: const Offset(0, 4),
                      blurRadius: 8,
                    ),
                    BoxShadow(
                      color: Colors.white.withValues(alpha: 0.18),
                      offset: const Offset(-1, -1),
                      blurRadius: 2,
                    ),
                  ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, color: Colors.white, size: fontSize + 4),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: fontSize,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Variante circolare (per play/pausa, impostazioni, ecc.)
class GradientIconButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback? onPressed;
  final double size;

  const GradientIconButton({
    super.key,
    required this.icon,
    required this.color,
    this.onPressed,
    this.size = 52,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    final baseColor = disabled ? color.withValues(alpha: 0.35) : color;

    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: Ink(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color.lerp(baseColor, Colors.white, 0.25)!,
                baseColor,
                Color.lerp(baseColor, Colors.black, 0.25)!,
              ],
            ),
            boxShadow: disabled
                ? []
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.45),
                      offset: const Offset(0, 3),
                      blurRadius: 6,
                    ),
                  ],
          ),
          child: Icon(icon, color: Colors.white, size: size * 0.5),
        ),
      ),
    );
  }
}
