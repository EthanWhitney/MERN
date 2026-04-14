class ChatMessage {
  final String id;
  final String content;
  final String senderId;
  final String senderUsername;
  final String senderProfilePicture;
  final DateTime createdAt;
  final bool isEdited;
  // Optional metadata for special message types (e.g. server invites)
  final Map<String, dynamic>? metadata;

  ChatMessage({
    required this.id,
    required this.content,
    required this.senderId,
    required this.senderUsername,
    required this.senderProfilePicture,
    required this.createdAt,
    this.isEdited = false,
    this.metadata,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    // Sender info can be nested under 'sender' or flat on the object
    final sender = json['sender'];
    final senderMap = sender is Map<String, dynamic> ? sender : <String, dynamic>{};

    // metadata — stored as a sub-object on the message document
    Map<String, dynamic>? meta;
    final rawMeta = json['metadata'];
    if (rawMeta is Map) {
      meta = Map<String, dynamic>.from(rawMeta);
    }

    return ChatMessage(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      content: json['content']?.toString() ??
          json['message']?.toString() ?? '',
      senderId: senderMap['userId']?.toString() ??
          json['senderId']?.toString() ??
          json['userId']?.toString() ?? '',
      senderUsername: senderMap['serverSpecificName']?.toString() ??
          senderMap['username']?.toString() ??
          json['senderUsername']?.toString() ?? 'Unknown',
      senderProfilePicture: senderMap['serverSpecificPFP']?.toString() ??
          senderMap['profilePicture']?.toString() ??
          json['senderProfilePicture']?.toString() ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isEdited: json['edited'] == true,
      metadata: meta,
    );
  }

  ChatMessage copyWith({String? content, bool? isEdited}) {
    return ChatMessage(
      id: id,
      content: content ?? this.content,
      senderId: senderId,
      senderUsername: senderUsername,
      senderProfilePicture: senderProfilePicture,
      createdAt: createdAt,
      isEdited: isEdited ?? this.isEdited,
      metadata: metadata,
    );
  }
}
