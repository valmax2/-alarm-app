import 'dart:convert';

import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import '../models/radio_station.dart';

class RadioDiscoveryException implements Exception {
  final String message;
  RadioDiscoveryException(this.message);
  @override
  String toString() => message;
}

/// Trova stazioni radio internet vicine usando la posizione del telefono:
/// GPS -> regione (geocoding) -> ricerca su Radio Browser (radio-browser.info),
/// un indice pubblico e gratuito di stream radio. Nessun link da inserire
/// manualmente.
class RadioDiscoveryService {
  static const List<String> _apiHosts = [
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
  ];

  Future<String> _resolveRegion() async {
    final permission = await Geolocator.checkPermission();
    var granted = permission;
    if (granted == LocationPermission.denied) {
      granted = await Geolocator.requestPermission();
    }
    if (granted == LocationPermission.denied ||
        granted == LocationPermission.deniedForever) {
      throw RadioDiscoveryException('Permesso di localizzazione negato.');
    }

    if (!await Geolocator.isLocationServiceEnabled()) {
      throw RadioDiscoveryException('Il GPS/localizzazione è disattivato.');
    }

    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.low,
    );

    final placemarks = await placemarkFromCoordinates(
      position.latitude,
      position.longitude,
    );
    if (placemarks.isEmpty) {
      throw RadioDiscoveryException('Non riesco a individuare la tua zona.');
    }

    final region = placemarks.first.administrativeArea;
    if (region == null || region.isEmpty) {
      throw RadioDiscoveryException('Non riesco a individuare la tua regione.');
    }
    return region;
  }

  Future<List<RadioStation>> _search(String host, Map<String, String> query) async {
    final uri = Uri.parse('$host/json/stations/search').replace(queryParameters: query);
    final response = await http
        .get(uri, headers: {'User-Agent': 'bedside_clock_app/1.0'})
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) {
      throw RadioDiscoveryException('Servizio radio non raggiungibile (${response.statusCode}).');
    }
    final decoded = jsonDecode(response.body) as List<dynamic>;
    return decoded
        .map((raw) {
          final item = raw as Map<String, dynamic>;
          final name = (item['name'] as String? ?? '').trim();
          final url = (item['url_resolved'] as String?)?.trim().isNotEmpty == true
              ? item['url_resolved'] as String
              : (item['url'] as String? ?? '');
          return RadioStation(name: name, url: url, isCustom: true);
        })
        .where((s) => s.name.isNotEmpty && s.url.isNotEmpty)
        .toList();
  }

  /// Prova gli host mirror di Radio Browser in ordine finché uno risponde.
  Future<List<RadioStation>> _searchWithFallbackHosts(Map<String, String> query) async {
    Object? lastError;
    for (final host in _apiHosts) {
      try {
        return await _search(host, query);
      } catch (e) {
        lastError = e;
      }
    }
    throw RadioDiscoveryException('Impossibile contattare il servizio radio: $lastError');
  }

  /// Cerca stazioni italiane della regione rilevata dalla posizione.
  /// Se non ce ne sono per quella regione, ripiega sulle stazioni
  /// nazionali italiane più popolari.
  Future<RadioDiscoveryResult> findStationsNearby() async {
    final region = await _resolveRegion();

    final byRegion = await _searchWithFallbackHosts({
      'country': 'Italy',
      'state': region,
      'limit': '25',
      'order': 'clickcount',
      'reverse': 'true',
      'hidebroken': 'true',
    });

    if (byRegion.isNotEmpty) {
      return RadioDiscoveryResult(region: region, stations: byRegion);
    }

    final national = await _searchWithFallbackHosts({
      'country': 'Italy',
      'limit': '25',
      'order': 'clickcount',
      'reverse': 'true',
      'hidebroken': 'true',
    });

    return RadioDiscoveryResult(region: region, stations: national, fellBackToNational: true);
  }
}

class RadioDiscoveryResult {
  final String region;
  final List<RadioStation> stations;
  final bool fellBackToNational;

  RadioDiscoveryResult({
    required this.region,
    required this.stations,
    this.fellBackToNational = false,
  });
}
