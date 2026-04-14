// FALLBACK STUB — use this content for voice_service.dart if flutter_webrtc
// fails to compile. It lets the rest of the app build while you resolve the
// WebRTC dependency separately.
//
// To use: rename this file to voice_service.dart (replacing the real one).

import 'package:flutter/foundation.dart';

class VoiceService extends ChangeNotifier {
  bool get isConnected => false;
  bool get isMuted => false;
  Map<String, Map<String, String>> get remoteUsers => {};
  Map<String, dynamic> get remoteStreams => {};

  Future<void> join({
    required String channelId,
    required String userId,
    required String username,
  }) async {
    debugPrint('[VoiceService stub] join called — flutter_webrtc not available');
  }

  Future<void> leave() async {}
  void toggleMute() {}

  @override
  void dispose() {
    super.dispose();
  }
}
