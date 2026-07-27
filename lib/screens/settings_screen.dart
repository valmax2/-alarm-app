import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/clock_settings.dart';
import '../models/radio_station.dart';
import '../services/brightness_service.dart';
import '../services/radio_player_service.dart';

const List<String> _weekdayShort = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<ClockSettings>();

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D11),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D11),
        title: const Text('Impostazioni'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionTitle('Aspetto'),
          _ClockStyleSelector(settings: settings),
          const SizedBox(height: 16),
          _StyleOptionsSection(settings: settings),
          _FontSection(settings: settings),
          const SizedBox(height: 16),
          _AccentColorSection(settings: settings),
          const SizedBox(height: 28),
          _SectionTitle('Orario'),
          _SwitchTile(
            label: 'Formato 24 ore',
            value: settings.use24HourFormat,
            onChanged: (v) => settings.update(() => settings.use24HourFormat = v),
          ),
          _SwitchTile(
            label: 'Mostra secondi',
            value: settings.showSeconds,
            onChanged: (v) => settings.update(() => settings.showSeconds = v),
          ),
          _SwitchTile(
            label: 'Mostra data',
            value: settings.showDate,
            onChanged: (v) => settings.update(() => settings.showDate = v),
          ),
          const SizedBox(height: 28),
          _SectionTitle('Display'),
          const Text('Luminosità schermo', style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 8),
          _BrightnessSelector(settings: settings),
          const SizedBox(height: 16),
          _SwitchTile(
            label: 'Protezione anti burn-in (sposta l\'orologio periodicamente)',
            value: settings.antiBurnInEnabled,
            onChanged: (v) => settings.update(() => settings.antiBurnInEnabled = v),
          ),
          const SizedBox(height: 8),
          const Text('Opacità pannello radio', style: TextStyle(color: Colors.white70)),
          Slider(
            value: settings.panelOpacity,
            min: 0.15,
            max: 0.85,
            divisions: 14,
            label: '${(settings.panelOpacity * 100).round()}%',
            onChanged: (v) => settings.update(() => settings.panelOpacity = v),
          ),
          const SizedBox(height: 28),
          _SectionTitle('Sveglia'),
          _AlarmSection(settings: settings),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _SwitchTile extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchTile({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label, style: const TextStyle(color: Colors.white70)),
      value: value,
      onChanged: onChanged,
    );
  }
}

class _BrightnessSelector extends StatelessWidget {
  final ClockSettings settings;
  const _BrightnessSelector({required this.settings});

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<ClockBrightness>(
      segments: [
        for (final level in ClockBrightness.values)
          ButtonSegment(value: level, label: Text(clockBrightnessLabels[level]!)),
      ],
      selected: {settings.brightness},
      onSelectionChanged: (s) {
        settings.update(() => settings.brightness = s.first);
        BrightnessService.apply(s.first);
      },
    );
  }
}

class _ClockStyleSelector extends StatelessWidget {
  final ClockSettings settings;
  const _ClockStyleSelector({required this.settings});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final style in ClockFaceStyle.values)
          ChoiceChip(
            label: Text(clockFaceStyleLabels[style]!),
            selected: settings.clockFaceStyle == style,
            onSelected: (_) => settings.update(() => settings.clockFaceStyle = style),
            selectedColor: settings.accentColor,
            backgroundColor: Colors.white10,
            labelStyle: TextStyle(
              color: settings.clockFaceStyle == style ? Colors.black : Colors.white70,
              fontWeight: settings.clockFaceStyle == style ? FontWeight.bold : FontWeight.normal,
            ),
          ),
      ],
    );
  }
}

class _StyleOptionsSection extends StatelessWidget {
  final ClockSettings settings;
  const _StyleOptionsSection({required this.settings});

  @override
  Widget build(BuildContext context) {
    if (settings.clockFaceStyle == ClockFaceStyle.dots) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          const Text('Spaziatura pallini', style: TextStyle(color: Colors.white70)),
          Slider(
            value: settings.dotSpacingScale,
            min: 0.7,
            max: 1.6,
            divisions: 9,
            label: settings.dotSpacingScale.toStringAsFixed(1),
            onChanged: (v) => settings.update(() => settings.dotSpacingScale = v),
          ),
        ],
      );
    }
    if (settings.clockFaceStyle == ClockFaceStyle.segments) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          const Text('Spessore linee', style: TextStyle(color: Colors.white70)),
          Slider(
            value: settings.segmentThicknessScale,
            min: 0.6,
            max: 1.5,
            divisions: 9,
            label: settings.segmentThicknessScale.toStringAsFixed(1),
            onChanged: (v) => settings.update(() => settings.segmentThicknessScale = v),
          ),
        ],
      );
    }
    return const SizedBox.shrink();
  }
}

class _FontSection extends StatelessWidget {
  final ClockSettings settings;
  const _FontSection({required this.settings});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Carattere', style: TextStyle(color: Colors.white70)),
            const Spacer(),
            DropdownButton<String>(
              value: settings.fontChoice,
              dropdownColor: const Color(0xFF1A1A24),
              style: const TextStyle(color: Colors.white),
              items: fontChoices
                  .map((f) => DropdownMenuItem(value: f, child: Text(f)))
                  .toList(),
              onChanged: (v) {
                if (v != null) settings.update(() => settings.fontChoice = v);
              },
            ),
          ],
        ),
        Row(
          children: [
            const Text('Grassetto', style: TextStyle(color: Colors.white70)),
            const Spacer(),
            Switch(
              value: settings.fontBold,
              onChanged: (v) => settings.update(() => settings.fontBold = v),
            ),
          ],
        ),
        const Text('Dimensione', style: TextStyle(color: Colors.white70)),
        Slider(
          value: settings.fontSizeScale,
          min: 0.6,
          max: 1.6,
          divisions: 10,
          label: settings.fontSizeScale.toStringAsFixed(1),
          onChanged: (v) => settings.update(() => settings.fontSizeScale = v),
        ),
      ],
    );
  }
}

class _AccentColorSection extends StatelessWidget {
  final ClockSettings settings;
  const _AccentColorSection({required this.settings});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Colore', style: TextStyle(color: Colors.white70)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 12,
          children: [
            for (int i = 0; i < accentPalette.length; i++)
              GestureDetector(
                onTap: () => settings.update(() => settings.accentColorIndex = i),
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: accentPalette[i],
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: settings.accentColorIndex == i ? Colors.white : Colors.transparent,
                      width: 3,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _AlarmSection extends StatelessWidget {
  final ClockSettings settings;
  const _AlarmSection({required this.settings});

  Future<void> _pickTime(BuildContext context) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: settings.alarmHour, minute: settings.alarmMinute),
    );
    if (picked != null) {
      settings.update(() {
        settings.alarmHour = picked.hour;
        settings.alarmMinute = picked.minute;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final radio = context.watch<RadioPlayerService>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SwitchTile(
          label: 'Sveglia attiva',
          value: settings.alarmEnabled,
          onChanged: (v) => settings.update(() => settings.alarmEnabled = v),
        ),
        Row(
          children: [
            const Text('Orario', style: TextStyle(color: Colors.white70)),
            const Spacer(),
            TextButton(
              onPressed: () => _pickTime(context),
              child: Text(
                '${settings.alarmHour.toString().padLeft(2, '0')}:${settings.alarmMinute.toString().padLeft(2, '0')}',
                style: TextStyle(color: settings.accentColor, fontSize: 22, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        const Text('Ripeti', style: TextStyle(color: Colors.white70)),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(7, (index) {
            final weekday = index + 1;
            final active = settings.alarmRepeatWeekdays.contains(weekday);
            return GestureDetector(
              onTap: () => settings.update(() {
                if (active) {
                  settings.alarmRepeatWeekdays.remove(weekday);
                } else {
                  settings.alarmRepeatWeekdays.add(weekday);
                }
              }),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: active ? settings.accentColor : Colors.white12,
                child: Text(
                  _weekdayShort[index],
                  style: TextStyle(color: active ? Colors.black : Colors.white54, fontSize: 12),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 8),
        _SwitchTile(
          label: 'Usa una radio come suoneria',
          value: settings.alarmUseRadioSound,
          onChanged: (v) => settings.update(() => settings.alarmUseRadioSound = v),
        ),
        if (settings.alarmUseRadioSound)
          DropdownButton<String>(
            isExpanded: true,
            value: settings.alarmRadioStationUrl ?? presetRadioStations.first.url,
            dropdownColor: const Color(0xFF1A1A24),
            style: const TextStyle(color: Colors.white),
            items: radio.allStations
                .map((s) => DropdownMenuItem(value: s.url, child: Text(s.name)))
                .toList(),
            onChanged: (v) {
              if (v != null) settings.update(() => settings.alarmRadioStationUrl = v);
            },
          ),
      ],
    );
  }
}
