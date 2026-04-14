class TextChannel {
  final String id;
  final String name;

  TextChannel({required this.id, required this.name});

  factory TextChannel.fromJson(Map<String, dynamic> json) {
    return TextChannel(
      id: json['_id']?.toString() ?? '',
      name: json['channelName'] ?? json['name'] ?? 'channel',
    );
  }
}

class VoiceChannel {
  final String id;
  final String name;

  VoiceChannel({required this.id, required this.name});

  factory VoiceChannel.fromJson(Map<String, dynamic> json) {
    return VoiceChannel(
      id: json['_id']?.toString() ?? '',
      name: json['channelName'] ?? json['name'] ?? 'voice',
    );
  }
}

class ServerModel {
  final String id;
  final String name;
  final String? icon;
  final List<dynamic> rawTextChannels;

  ServerModel({
    required this.id,
    required this.name,
    this.icon,
    required this.rawTextChannels,
  });

  List<TextChannel> get textChannels {
    return rawTextChannels.map((ch) {
      if (ch is Map<String, dynamic>) return TextChannel.fromJson(ch);
      return TextChannel(id: ch.toString(), name: 'channel');
    }).toList();
  }

  factory ServerModel.fromJson(Map<String, dynamic> json) {
    return ServerModel(
      id: json['_id']?.toString() ?? '',
      name: json['serverName'] ?? 'Server',
      icon: json['serverIcon'],
      rawTextChannels: json['textChannels'] ?? [],
    );
  }
}
