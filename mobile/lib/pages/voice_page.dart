// FALLBACK STUB — use this content for voice_page.dart if flutter_webrtc
// fails to compile.

import 'package:flutter/material.dart';
import 'package:mobile/services/voice_service.dart';

class VoicePage extends StatelessWidget {
  final String channelId;
  final String channelName;
  final String userId;
  final String username;
  final VoiceService voiceService;

  const VoicePage({
    super.key,
    required this.channelId,
    required this.channelName,
    required this.userId,
    required this.username,
    required this.voiceService,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF313338),
      appBar: AppBar(
        backgroundColor: const Color(0xFF313338),
        title: Text(channelName,
            style: const TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.volume_up, color: Color(0xFF949BA4), size: 64),
            SizedBox(height: 16),
            Text(
              'Voice channels are not available\non this build.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF949BA4), fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }
}
