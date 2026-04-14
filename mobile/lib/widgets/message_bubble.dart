import 'package:mobile/models/chat_message.dart';

/// Groups consecutive messages from the same sender into one visual block.
class MessageGroup {
  final String senderId;
  final String senderUsername;
  final String senderProfilePicture;
  final List<ChatMessage> messages;

  MessageGroup({
    required this.senderId,
    required this.senderUsername,
    required this.senderProfilePicture,
    required this.messages,
  });
}

List<MessageGroup> groupMessages(List<ChatMessage> messages) {
  if (messages.isEmpty) return [];

  final groups = <MessageGroup>[];
  for (final msg in messages) {
    if (groups.isEmpty || groups.last.senderId != msg.senderId) {
      groups.add(MessageGroup(
        senderId: msg.senderId,
        senderUsername: msg.senderUsername,
        senderProfilePicture: msg.senderProfilePicture,
        messages: [msg],
      ));
    } else {
      groups.last.messages.add(msg);
    }
  }
  return groups;
}
