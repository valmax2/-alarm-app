import 'package:flutter/material.dart';

import 'radio_control_bar.dart';

/// Nasconde il pannello radio dietro una piccola freccia, per lasciare
/// l'orologio a schermo intero. Tocca la freccia per aprire/chiudere.
class CollapsibleRadioBar extends StatefulWidget {
  const CollapsibleRadioBar({super.key});

  @override
  State<CollapsibleRadioBar> createState() => _CollapsibleRadioBarState();
}

class _CollapsibleRadioBarState extends State<CollapsibleRadioBar> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: () => setState(() => _expanded = !_expanded),
          child: Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              _expanded ? Icons.keyboard_arrow_down_rounded : Icons.keyboard_arrow_up_rounded,
              color: Colors.white54,
              size: 22,
            ),
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          alignment: Alignment.bottomCenter,
          child: _expanded ? const RadioControlBar() : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
