import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/clock_settings.dart';
import '../models/radio_station.dart';
import '../services/radio_player_service.dart';
import 'gradient_button.dart';

class RadioControlBar extends StatelessWidget {
  const RadioControlBar({super.key});

  Future<void> _showAddStationDialog(BuildContext context) async {
    final nameController = TextEditingController();
    final urlController = TextEditingController();
    final radio = context.read<RadioPlayerService>();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A24),
        title: const Text('Aggiungi stazione radio', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Nome stazione'),
            ),
            TextField(
              controller: urlController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'URL stream (http/https)'),
              keyboardType: TextInputType.url,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Annulla'),
          ),
          TextButton(
            onPressed: () {
              final name = nameController.text.trim();
              final url = urlController.text.trim();
              if (name.isNotEmpty && url.isNotEmpty) {
                radio.addCustomStation(name, url);
              }
              Navigator.of(dialogContext).pop();
            },
            child: const Text('Aggiungi'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final radio = context.watch<RadioPlayerService>();
    final settings = context.watch<ClockSettings>();
    final accent = settings.accentColor;
    final stations = radio.allStations;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: stations.length + 2,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _DiscoverChip(
                    loading: radio.isDiscovering,
                    onTap: radio.isDiscovering ? null : () => radio.discoverNearbyStations(),
                  );
                }
                final stationIndex = index - 1;
                if (stationIndex == stations.length) {
                  return _AddChip(onTap: () => _showAddStationDialog(context));
                }
                final RadioStation station = stations[stationIndex];
                final bool active = radio.currentStation?.url == station.url;
                return _StationChip(
                  station: station,
                  active: active,
                  accent: accent,
                  onTap: () => radio.play(station),
                  onRemove: station.isCustom ? () => radio.removeCustomStation(station) : null,
                );
              },
            ),
          ),
          if (radio.nearbyRegion != null && radio.nearbyStations.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Stazioni trovate per: ${radio.nearbyRegion}',
              style: const TextStyle(color: Colors.white38, fontSize: 11),
            ),
          ],
          if (radio.discoveryError != null) ...[
            const SizedBox(height: 4),
            Text(
              radio.discoveryError!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              GradientIconButton(
                icon: Icons.stop_rounded,
                color: Colors.white24,
                size: 40,
                onPressed: radio.currentStation == null ? null : radio.stop,
              ),
              const SizedBox(width: 10),
              GradientIconButton(
                icon: radio.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: accent,
                size: 46,
                onPressed: radio.currentStation == null ? null : radio.togglePlayPause,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  radio.isLoading
                      ? 'Connessione...'
                      : (radio.currentStation?.name ?? 'Nessuna stazione'),
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ),
              const Icon(Icons.volume_down, color: Colors.white38, size: 18),
              SizedBox(
                width: 90,
                child: Slider(
                  value: radio.volume.clamp(0.0, 1.0),
                  activeColor: accent,
                  inactiveColor: Colors.white24,
                  onChanged: radio.setVolume,
                ),
              ),
            ],
          ),
          if (radio.errorMessage != null) ...[
            const SizedBox(height: 4),
            Text(
              radio.errorMessage!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }
}

class _StationChip extends StatelessWidget {
  final RadioStation station;
  final bool active;
  final Color accent;
  final VoidCallback onTap;
  final VoidCallback? onRemove;

  const _StationChip({
    required this.station,
    required this.active,
    required this.accent,
    required this.onTap,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onRemove,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? accent.withValues(alpha: 0.85) : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
        ),
        alignment: Alignment.center,
        child: Text(
          station.name,
          style: TextStyle(
            color: active ? Colors.black : Colors.white70,
            fontSize: 12,
            fontWeight: active ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

class _DiscoverChip extends StatelessWidget {
  final bool loading;
  final VoidCallback? onTap;
  const _DiscoverChip({required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
        ),
        alignment: Alignment.center,
        child: loading
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70),
              )
            : const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.near_me, color: Colors.white70, size: 15),
                  SizedBox(width: 6),
                  Text('Vicino a te', style: TextStyle(color: Colors.white70, fontSize: 12)),
                ],
              ),
      ),
    );
  }
}

class _AddChip extends StatelessWidget {
  final VoidCallback onTap;
  const _AddChip({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
        ),
        alignment: Alignment.center,
        child: const Icon(Icons.add, color: Colors.white70, size: 18),
      ),
    );
  }
}
