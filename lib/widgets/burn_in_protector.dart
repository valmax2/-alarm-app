import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

/// Sposta lentamente il proprio contenuto entro una piccola area centrale
/// per evitare che un'immagine statica "bruci" il display se il telefono
/// resta acceso per ore come orologio da comodino.
class BurnInProtector extends StatefulWidget {
  final Widget child;
  final bool enabled;
  final Duration interval;

  const BurnInProtector({
    super.key,
    required this.child,
    this.enabled = true,
    this.interval = const Duration(seconds: 25),
  });

  @override
  State<BurnInProtector> createState() => _BurnInProtectorState();
}

class _BurnInProtectorState extends State<BurnInProtector> {
  Timer? _timer;
  Alignment _alignment = Alignment.center;
  final _random = Random();

  @override
  void initState() {
    super.initState();
    _scheduleTimer();
  }

  @override
  void didUpdateWidget(covariant BurnInProtector oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.enabled != oldWidget.enabled) {
      if (!widget.enabled) {
        _timer?.cancel();
        setState(() => _alignment = Alignment.center);
      } else {
        _scheduleTimer();
      }
    }
  }

  void _scheduleTimer() {
    _timer?.cancel();
    if (!widget.enabled) return;
    _timer = Timer.periodic(widget.interval, (_) {
      setState(() {
        _alignment = Alignment(
          (_random.nextDouble() - 0.5) * 0.5,
          (_random.nextDouble() - 0.5) * 0.5,
        );
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedAlign(
      alignment: widget.enabled ? _alignment : Alignment.center,
      duration: const Duration(seconds: 3),
      curve: Curves.easeInOut,
      child: widget.child,
    );
  }
}
