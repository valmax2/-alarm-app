import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../models/radio_station.dart';
import 'settings_repository.dart';

/// Gestisce la riproduzione dello stream radio internet.
class RadioPlayerService extends ChangeNotifier {
  final AudioPlayer _player = AudioPlayer();

  List<RadioStation> customStations = [];
  RadioStation? currentStation;
  bool isLoading = false;
  String? errorMessage;

  bool get isPlaying => _player.playing;

  List<RadioStation> get allStations => [
        ...presetRadioStations,
        ...customStations,
      ];

  Future<void> init() async {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());

    _player.playerStateStream.listen((_) => notifyListeners());

    customStations = await SettingsRepository.loadCustomStations();
    notifyListeners();
  }

  Future<void> play(RadioStation station) async {
    isLoading = true;
    errorMessage = null;
    currentStation = station;
    notifyListeners();
    try {
      await _player.setUrl(station.url);
      await _player.play();
    } catch (_) {
      errorMessage = 'Impossibile riprodurre "${station.name}". Controlla la connessione o l\'URL.';
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> playUrl(String url, {String name = 'Sveglia'}) async {
    await play(RadioStation(name: name, url: url, isCustom: true));
  }

  Future<void> stop() async {
    await _player.stop();
    currentStation = null;
    notifyListeners();
  }

  Future<void> pause() async {
    await _player.pause();
  }

  Future<void> resume() async {
    await _player.play();
  }

  Future<void> togglePlayPause() async {
    if (isPlaying) {
      await pause();
    } else if (currentStation != null) {
      await resume();
    }
  }

  Future<void> setVolume(double volume) async {
    await _player.setVolume(volume);
    notifyListeners();
  }

  double get volume => _player.volume;

  Future<void> addCustomStation(String name, String url) async {
    customStations = [...customStations, RadioStation(name: name, url: url, isCustom: true)];
    await SettingsRepository.saveCustomStations(customStations);
    notifyListeners();
  }

  Future<void> removeCustomStation(RadioStation station) async {
    customStations = customStations.where((s) => s.url != station.url).toList();
    if (currentStation?.url == station.url) {
      await stop();
    }
    await SettingsRepository.saveCustomStations(customStations);
    notifyListeners();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}
