class RadioStation {
  final String name;
  final String url;
  final bool isCustom;

  const RadioStation({
    required this.name,
    required this.url,
    this.isCustom = false,
  });

  Map<String, dynamic> toJson() => {'name': name, 'url': url};

  factory RadioStation.fromJson(Map<String, dynamic> json) => RadioStation(
        name: json['name'] as String,
        url: json['url'] as String,
        isCustom: true,
      );
}

const List<RadioStation> presetRadioStations = [
  RadioStation(name: 'RAI Radio 1', url: 'https://icestreaming.rai.it/1.mp3'),
  RadioStation(name: 'RAI Radio 2', url: 'https://icestreaming.rai.it/2.mp3'),
  RadioStation(name: 'RAI Radio 3', url: 'https://icestreaming.rai.it/3.mp3'),
  RadioStation(
    name: 'SomaFM Groove Salad',
    url: 'https://ice1.somafm.com/groovesalad-256-mp3',
  ),
  RadioStation(
    name: 'Radio Paradise',
    url: 'https://stream.radioparadise.com/mp3-192',
  ),
];
