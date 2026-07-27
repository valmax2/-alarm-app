import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';

enum UnlockMode { swipe, mathPuzzle }

class AlarmRingScreen extends StatefulWidget {
  final String alarmTitle;
  final VoidCallback onDismissed;
  final Function(int minutes) onSnoozed;

  const AlarmRingScreen({
    super.key,
    this.alarmTitle = 'Sveglia Mattutina',
    required this.onDismissed,
    required this.onSnoozed,
  });

  @override
  State<AlarmRingScreen> createState() => _AlarmRingScreenState();
}

class _AlarmRingScreenState extends State<AlarmRingScreen>
    with SingleTickerProviderStateMixin {
  // Modalità di sblocco scelta (Gesture o Enigma)
  UnlockMode _currentMode = UnlockMode.mathPuzzle;

  // Controller Animazione Pulsante per l'effetto visivo della sveglia
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  // Stato Swipe Gesture
  double _dragPosition = 0.0;
  final double _maxDragWidth = 260.0;

  // Stato Enigma Matematico
  late int _num1;
  late int _num2;
  late int _correctAnswer;
  List<int> _options = [];
  int? _selectedOption;
  bool _isWrongAnswer = false;

  @override
  void initState() {
    super.initState();

    // Animazione di pulsazione per lo sfondo/orologio
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _generateMathPuzzle();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  /// Genera un enigma matematico casuale con opzioni a scelta multipla
  void _generateMathPuzzle() {
    final random = Random();
    _num1 = random.nextInt(30) + 12; // Es. 12..41
    _num2 = random.nextInt(20) + 7;  // Es. 7..26
    _correctAnswer = _num1 + _num2;

    Set<int> optionsSet = {_correctAnswer};
    while (optionsSet.length < 4) {
      int offset = (random.nextInt(10) + 1) * (random.nextBool() ? 1 : -1);
      int wrongOption = _correctAnswer + offset;
      if (wrongOption > 0) {
        optionsSet.add(wrongOption);
      }
    }

    _options = optionsSet.toList()..shuffle();
    _selectedOption = null;
    _isWrongAnswer = false;
  }

  /// Verifica la risposta dell'enigma
  void _checkAnswer(int selected) {
    setState(() {
      _selectedOption = selected;
    });

    if (selected == _correctAnswer) {
      // Risposta corretta: Spegni sveglia
      widget.onDismissed();
    } else {
      // Risposta errata: Genera un nuovo enigma dopo una breve vibrazione visiva
      setState(() {
        _isWrongAnswer = true;
      });

      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) {
          setState(() {
            _generateMathPuzzle();
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final timeStr =
        "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D11),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // 1. Testata: Nome Sveglia + Selettore Modalità Sblocco
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.alarmTitle,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Colors.redAccent,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text(
                            'SVEGLIA ATTIVA',
                            style: TextStyle(
                              color: Colors.redAccent,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  // Toggle per passare da Gesture a Enigma
                  SegmentedButton<UnlockMode>(
                    segments: const [
                      ButtonSegment(
                        value: UnlockMode.mathPuzzle,
                        icon: Icon(Icons.calculate, size: 18),
                      ),
                      ButtonSegment(
                        value: UnlockMode.swipe,
                        icon: Icon(Icons.swipe_right, size: 18),
                      ),
                    ],
                    selected: {_currentMode},
                    onSelectionChanged: (Set<UnlockMode> newSelection) {
                      setState(() {
                        _currentMode = newSelection.first;
                        _dragPosition = 0;
                      });
                    },
                    style: ButtonStyle(
                      visualDensity: VisualDensity.compact,
                      backgroundColor: WidgetStateProperty.all(Colors.white10),
                    ),
                  ),
                ],
              ),

              // 2. Orologio gigante con effetto pulse
              ScaleTransition(
                scale: _pulseAnimation,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      timeStr,
                      style: TextStyle(
                        fontSize: 90,
                        fontWeight: FontWeight.bold,
                        color: Colors.red.shade400,
                        shadows: [
                          Shadow(
                            color: Colors.redAccent.withOpacity(0.6),
                            blurRadius: 30,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Risolvi l\'azione per spegnere l\'allarme',
                      style: TextStyle(color: Colors.white54, fontSize: 14),
                    ),
                  ],
                ),
              ),

              // 3. Sezione Centrale Dinamica: Enigma Matematico o Swipe Slider
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                child: _currentMode == UnlockMode.mathPuzzle
                    ? _buildMathPuzzleCard()
                    : _buildSwipeToUnlockCard(),
              ),

              // 4. Pulsante Snooze (Rinvio Sveglia)
              SizedBox(
                width: double.infinity,
                height: 56,
                child: OutlinedButton.icon(
                  onPressed: () => widget.onSnoozed(9), // Snooze 9 Minuti
                  icon: const Icon(Icons.snooze, color: Colors.amber),
                  label: const Text(
                    'RINVIA (9 MIN)',
                    style: TextStyle(
                      color: Colors.amber,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.1,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.amber, width: 1.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Widget per l'Enigma Matematico
  Widget _buildMathPuzzleCard() {
    return Container(
      key: const ValueKey('math_card'),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A24),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: _isWrongAnswer ? Colors.red : Colors.white10,
          width: 1.5,
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.psychology, color: Colors.purpleAccent, size: 24),
              const SizedBox(width: 8),
              Text(
                _isWrongAnswer ? 'Risposta Errata! Riprova:' : 'Risolvi l\'operazione:',
                style: TextStyle(
                  color: _isWrongAnswer ? Colors.redAccent : Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            '$_num1 + $_num2 = ?',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.bold,
              letterSpacing: 2.0,
            ),
          ),
          const SizedBox(height: 20),
          // Griglia delle risposte
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 2.5,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: _options.length,
            itemBuilder: (context, index) {
              final option = _options[index];
              final isSelected = _selectedOption == option;

              return ElevatedButton(
                onPressed: () => _checkAnswer(option),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isSelected
                      ? (option == _correctAnswer
                          ? Colors.green
                          : Colors.red)
                      : Colors.white.withOpacity(0.08),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  '$option',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  /// Widget per la Gesture Swipe to Unlock
  Widget _buildSwipeToUnlockCard() {
    return Container(
      key: const ValueKey('swipe_card'),
      width: _maxDragWidth + 60,
      height: 70,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A24),
        borderRadius: BorderRadius.circular(35),
        border: Border.all(color: Colors.white10),
      ),
      child: Stack(
        children: [
          const Center(
            child: Text(
              'SCORRI PER SPEGNERE  >>>',
              style: TextStyle(
                color: Colors.white38,
                fontWeight: FontWeight.bold,
                fontSize: 13,
                letterSpacing: 1.2,
              ),
            ),
          ),
          Positioned(
            left: _dragPosition,
            child: GestureDetector(
              onHorizontalDragUpdate: (details) {
                setState(() {
                  _dragPosition += details.delta.dx;
                  if (_dragPosition < 0) _dragPosition = 0;
                  if (_dragPosition > _maxDragWidth) {
                    _dragPosition = _maxDragWidth;
                  }
                });
              },
              onHorizontalDragEnd: (details) {
                if (_dragPosition >= _maxDragWidth * 0.85) {
                  // Sblocco completato!
                  widget.onDismissed();
                } else {
                  // Ritorna indietro con effetto molla
                  setState(() {
                    _dragPosition = 0;
                  });
                }
              },
              child: Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: Colors.redAccent,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.redAccent.withOpacity(0.5),
                      blurRadius: 10,
                      spreadRadius: 2,
                    )
                  ],
                ),
                child: const Icon(
                  Icons.alarm_off,
                  color: Colors.white,
                  size: 28,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
