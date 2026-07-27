import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/clock_settings.dart';
import '../models/radio_station.dart';

/// Legge e scrive le impostazioni dell'app su disco (SharedPreferences).
class SettingsRepository {
  static const _settingsKey = 'clock_settings_v1';
  static const _customStationsKey = 'custom_radio_stations_v1';

  static Future<ClockSettings> loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_settingsKey);
    if (raw == null) return ClockSettings();
    try {
      return ClockSettings.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return ClockSettings();
    }
  }

  static Future<void> saveSettings(ClockSettings settings) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_settingsKey, jsonEncode(settings.toJson()));
  }

  static Future<List<RadioStation>> loadCustomStations() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_customStationsKey);
    if (raw == null) return [];
    return raw
        .map((s) => RadioStation.fromJson(jsonDecode(s) as Map<String, dynamic>))
        .toList();
  }

  static Future<void> saveCustomStations(List<RadioStation> stations) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _customStationsKey,
      stations.map((s) => jsonEncode(s.toJson())).toList(),
    );
  }
}
