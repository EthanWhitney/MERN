class FriendModel {
  final String id;
  final String username;
  final String? profilePicture;
  final bool online;

  FriendModel({
    required this.id,
    required this.username,
    this.profilePicture,
    this.online = false,
  });

  FriendModel copyWith({bool? online}) => FriendModel(
        id: id,
        username: username,
        profilePicture: profilePicture,
        online: online ?? this.online,
      );

  factory FriendModel.fromJson(Map<String, dynamic> json) {
    return FriendModel(
      id: json['_id']?.toString() ?? '',
      username: json['username'] ?? 'Unknown',
      profilePicture: json['profilePicture'],
      online: json['online'] == true || json['isOnline'] == true,
    );
  }
}
