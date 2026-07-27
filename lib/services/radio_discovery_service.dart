import 'dart:async';
import 'dart:convert';
import 'dart:io';

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

class _Candidate {
  final RadioStation station;
  final bool lastCheckOk;
  _Candidate(this.station, this.lastCheckOk);
}

/// Trova e verifica stazioni radio internet usando l'indice pubblico e
/// gratuito Radio Browser (radio-browser.info). Ogni stazione restituita
/// viene controllata dal vivo (connessione reale allo stream) prima di
/// essere proposta, così i link non funzionanti non arrivano all'utente.
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

    final placemarks = await Geocoding().placemarkFromCoordinates(
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

  Future<List<_Candidate>> _rawSearch(String host, Map<String, String> query) async {
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
          final lastCheckOk = item['lastcheckok'] == 1 || item['lastcheckok'] == true;
          return _Candidate(RadioStation(name: name, url: url, isCustom: true), lastCheckOk);
        })
        .where((c) => c.station.name.isNotEmpty && c.station.url.isNotEmpty)
        .toList();
  }

  /// Prova gli host mirror di Radio Browser in ordine finché uno risponde.
  Future<List<_Candidate>> _searchWithFallbackHosts(Map<String, String> query) async {
    Object? lastError;
    for (final host in _apiHosts) {
      try {
        return await _rawSearch(host, query);
      } catch (e) {
        lastError = e;
      }
    }
    throw RadioDiscoveryException('Impossibile contattare il servizio radio: $lastError');
  }

  /// Apre davvero una connessione allo stream per pochi istanti per
  /// verificare che risponda. Non scarica l'audio: chiude subito dopo
  /// aver ricevuto lo stato della risposta.
  static Future<bool> _isStreamReachable(String url) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 5);
    try {
      final uri = Uri.parse(url);
      if (uri.scheme != 'http' && uri.scheme != 'https') return false;
      final request = await client.getUrl(uri).timeout(const Duration(seconds: 5));
      request.headers.set(HttpHeaders.userAgentHeader, 'bedside_clock_app/1.0');
      final response = await request.close().timeout(const Duration(seconds: 5));
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (_) {
      return false;
    } finally {
      client.close(force: true);
    }
  }

  /// Filtra i candidati tenendo solo quelli effettivamente raggiungibili in
  /// questo momento, verificati in parallelo. Chi risultava già "non ok"
  /// secondo Radio Browser (`lastcheckok`) non viene nemmeno controllato.
  Future<List<RadioStation>> _verifyWorking(List<_Candidate> candidates, {int maxResults = 15}) async {
    final toCheck = candidates.where((c) => c.lastCheckOk).toList();
    final results = await Future.wait(
      toCheck.map((c) async {
        final ok = await _isStreamReachable(c.station.url);
        return ok ? c.station : null;
      }),
    );
    return results.whereType<RadioStation>().take(maxResults).toList();
  }

  /// Cerca stazioni italiane della regione rilevata dalla posizione,
  /// verificandole dal vivo. Se non ce ne sono di funzionanti per quella
  /// regione, ripiega sulle stazioni nazionali italiane più popolari.
  Future<RadioDiscoveryResult> findStationsNearby() async {
    final region = await _resolveRegion();

    final byRegion = await _searchWithFallbackHosts({
      'country': 'Italy',
      'state': region,
      'limit': '30',
      'order': 'clickcount',
      'reverse': 'true',
      'hidebroken': 'true',
    });
    final workingByRegion = await _verifyWorking(byRegion);

    if (workingByRegion.isNotEmpty) {
      return RadioDiscoveryResult(region: region, stations: workingByRegion);
    }

    final national = await _searchWithFallbackHosts({
      'country': 'Italy',
      'limit': '30',
      'order': 'clickcount',
      'reverse': 'true',
      'hidebroken': 'true',
    });
    final workingNational = await _verifyWorking(national);

    return RadioDiscoveryResult(
      region: region,
      stations: workingNational,
      fellBackToNational: true,
    );
  }

  /// Cerca stazioni per nome (es. "Radio DJ") ovunque nel mondo, restituendo
  /// solo quelle il cui stream risponde davvero in questo momento.
  Future<List<RadioStation>> searchByName(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return [];

    final candidates = await _searchWithFallbackHosts({
      'name': trimmed,
      'limit': '20',
      'order': 'clickcount',
      'reverse': 'true',
      'hidebroken': 'true',
    });
    return _verifyWorking(candidates, maxResults: 8);
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
