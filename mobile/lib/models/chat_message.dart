class ChatMessage {
  final String id;
  final String content;
  final String senderId;
  final String senderUsername;
  final String senderProfilePicture;
  final DateTime createdAt;
  final bool isEdited;

  ChatMessage({
    required this.id,
    required this.content,
    required this.senderId,
    required this.senderUsername,
    required this.senderProfilePicture,
    required this.createdAt,
    this.isEdited = false,
  });

  // This factory method translates your Node.js JSON into a Flutter Object
  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    // Handling the nested 'sender' object from your chatController.js
    final senderParams = json['sender'] ?? {};
    
    return ChatMessage(
      id: json['_id'] ?? '',
      content: json['message'] ?? json['content'] ?? '', // Handles both variations you use
      senderId: senderParams['userId']?.toString() ?? '',
      senderUsername: senderParams['serverSpecificName'] ?? senderParams['username'] ?? 'Unknown User',
      senderProfilePicture: senderParams['serverSpecificPFP'] ?? senderParams['profilePicture'] ?? '',
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt']) 
          : DateTime.now(),
      isEdited: json['edited'] ?? false,
    );
  }
}