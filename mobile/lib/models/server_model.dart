class ServerModel {
  final String id;
  final String name;
  final String? icon;
  final List<dynamic> textChannels;

  ServerModel({required this.id, required this.name, this.icon, required this.textChannels});

  factory ServerModel.fromJson(Map<String, dynamic> json) {
    return ServerModel(
      id: json['_id'],
      name: json['serverName'],
      icon: json['serverIcon'],
      textChannels: json['textChannels'] ?? [],
    );
  }
}