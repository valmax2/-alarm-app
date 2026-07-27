import 'dart:async';

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

  Future<void> _showSearchDialog(BuildContext context) async {
    final controller = TextEditingController();
    final radio = context.read<RadioPlayerService>();

    void doSearch() {
      final query = controller.text.trim();
      if (query.isNotEmpty) radio.searchStations(query);
    }

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A24),
        title: const Text('Cerca una radio', style: TextStyle(color: Colors.white)),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: controller,
                      autofocus: true,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: 'Es. Radio DJ'),
                      onSubmitted: (_) => doSearch(),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.search, color: Colors.white70),
                    onPressed: doSearch,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Verifico solo stazioni con lo stream attualmente attivo.',
                style: TextStyle(color: Colors.white38, fontSize: 11),
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 280),
                child: Consumer<RadioPlayerService>(
                  builder: (context, radio, _) {
                    if (radio.isSearching) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 28),
                        child: Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      );
                    }
                    if (radio.searchError != null) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          radio.searchError!,
                          style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        ),
                      );
                    }
                    if (radio.searchResults.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          'Scrivi il nome di una radio e tocca cerca.',
                          style: TextStyle(color: Colors.white38, fontSize: 13),
                        ),
                      );
                    }
                    return ListView.builder(
                      shrinkWrap: true,
                      itemCount: radio.searchResults.length,
                      itemBuilder: (context, index) {
                        final station = radio.searchResults[index];
                        return ListTile(
                          dense: true,
                          title: Text(station.name, style: const TextStyle(color: Colors.white)),
                          leading: const Icon(Icons.wifi_tethering, color: Colors.greenAccent, size: 18),
                          trailing: IconButton(
                            icon: Icon(
                              radio.isFavorite(station) ? Icons.star : Icons.star_border,
                              color: Colors.amber,
                            ),
                            onPressed: () => radio.toggleFavorite(station),
                          ),
                          onTap: () {
                            radio.installAndPlay(station);
                            Navigator.of(dialogContext).pop();
                          },
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Chiudi'),
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
    final favorites = radio.favoriteStations;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: settings.panelOpacity),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (favorites.isNotEmpty) ...[
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: favorites.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final station = favorites[index];
                  final active = radio.currentStation?.url == station.url;
                  return _StationChip(
                    station: station,
                    active: active,
                    accent: Colors.amber,
                    isFavorite: true,
                    onTap: () => radio.play(station),
                    onToggleFavorite: () => radio.toggleFavorite(station),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: stations.length + 3,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _DiscoverChip(
                    loading: radio.isDiscovering,
                    onTap: radio.isDiscovering ? null : () => radio.discoverNearbyStations(),
                  );
                }
                if (index == 1) {
                  return _SearchChip(onTap: () => _showSearchDialog(context));
                }
                final stationIndex = index - 2;
                if (stationIndex == stations.length) {
                  return _AddChip(onTap: () => _showAddStationDialog(context));
                }
                final RadioStation station = stations[stationIndex];
                final bool active = radio.currentStation?.url == station.url;
                return _StationChip(
                  station: station,
                  active: active,
                  accent: accent,
                  isFavorite: radio.isFavorite(station),
                  onTap: () => radio.play(station),
                  onToggleFavorite: () => radio.toggleFavorite(station),
                  onRemove: station.isCustom ? () => radio.removeCustomStation(station) : null,
                );
              },
            ),
          ),
          if (radio.nearbyRegion != null && radio.nearbyStations.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Stazioni verificate per: ${radio.nearbyRegion}',
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
              _VolumeControl(
                volume: radio.volume,
                accent: accent,
                onChanged: radio.setVolume,
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

/// Icona del volume che, al tocco, apre una barra grande e comoda da
/// trascinare; si richiude da sola qualche istante dopo l'ultima modifica.
class _VolumeControl extends StatefulWidget {
  final double volume;
  final Color accent;
  final ValueChanged<double> onChanged;

  const _VolumeControl({
    required this.volume,
    required this.accent,
    required this.onChanged,
  });

  @override
  State<_VolumeControl> createState() => _VolumeControlState();
}

class _VolumeControlState extends State<_VolumeControl> {
  bool _expanded = false;
  Timer? _collapseTimer;

  void _scheduleCollapse() {
    _collapseTimer?.cancel();
    _collapseTimer = Timer(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _expanded = false);
    });
  }

  @override
  void dispose() {
    _collapseTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      alignment: Alignment.centerRight,
      child: _expanded
          ? SizedBox(
              width: 170,
              height: 40,
              child: Row(
                children: [
                  Icon(
                    widget.volume <= 0.02 ? Icons.volume_off : Icons.volume_up,
                    color: Colors.white54,
                    size: 20,
                  ),
                  Expanded(
                    child: SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 6,
                        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 9),
                        overlayShape: const RoundSliderOverlayShape(overlayRadius: 16),
                      ),
                      child: Slider(
                        value: widget.volume.clamp(0.0, 1.0),
                        activeColor: widget.accent,
                        inactiveColor: Colors.white24,
                        onChanged: (v) {
                          widget.onChanged(v);
                          _scheduleCollapse();
                        },
                      ),
                    ),
                  ),
                ],
              ),
            )
          : GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                setState(() => _expanded = true);
                _scheduleCollapse();
              },
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Icon(
                  widget.volume <= 0.02 ? Icons.volume_off : Icons.volume_up,
                  color: Colors.white54,
                  size: 22,
                ),
              ),
            ),
    );
  }
}

class _StationChip extends StatelessWidget {
  final RadioStation station;
  final bool active;
  final Color accent;
  final bool isFavorite;
  final VoidCallback onTap;
  final VoidCallback onToggleFavorite;
  final VoidCallback? onRemove;

  const _StationChip({
    required this.station,
    required this.active,
    required this.accent,
    required this.isFavorite,
    required this.onTap,
    required this.onToggleFavorite,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onRemove,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: active ? accent.withValues(alpha: 0.85) : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              station.name,
              style: TextStyle(
                color: active ? Colors.black : Colors.white70,
                fontSize: 12,
                fontWeight: active ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onToggleFavorite,
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: Icon(
                  isFavorite ? Icons.star : Icons.star_border,
                  size: 15,
                  color: isFavorite ? Colors.amber : (active ? Colors.black45 : Colors.white38),
                ),
              ),
            ),
          ],
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

class _SearchChip extends StatelessWidget {
  final VoidCallback onTap;
  const _SearchChip({required this.onTap});

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
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search, color: Colors.white70, size: 15),
            SizedBox(width: 6),
            Text('Cerca', style: TextStyle(color: Colors.white70, fontSize: 12)),
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
