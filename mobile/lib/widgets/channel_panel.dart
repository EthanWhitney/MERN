import 'package:flutter/material.dart';
import 'package:mobile/app_state.dart';
import 'home_components.dart';

class ChannelPanel extends StatelessWidget {
  final SyncordAppState state;
  final Function(TextChannel) onSelectChannel;
  final Function(String) onCreateText;
  final Function(String) onCreateVoice;
  final Function(ServerModel) onShowInvite;

  const ChannelPanel({
    super.key, 
    required this.state, 
    required this.onSelectChannel,
    required this.onCreateText,
    required this.onCreateVoice,
    required this.onShowInvite,
  });

  @override
  Widget build(BuildContext context) {
    final server = state.selectedServer;
    if (server == null) return const Center(child: Text("Select a server"));

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Expanded(child: Text(server.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
              IconButton(icon: const Icon(Icons.link, color: Colors.grey), onPressed: () => onShowInvite(server)),
            ],
          ),
        ),
        const Divider(color: Color(0xFF1E1F22)),
        Expanded(
          child: ListView(
            children: [
              SectionHeader(label: 'TEXT CHANNELS', onAdd: () => onCreateText(server.id)),
              ...state.channelsFor(server.id).map((ch) => ChannelTile(
                channel: ch, 
                isActive: state.selectedChannel?.id == ch.id, 
                onTap: () => onSelectChannel(ch)
              )),
              const SizedBox(height: 16),
              SectionHeader(label: 'VOICE CHANNELS', onAdd: () => onCreateVoice(server.id)),
              ...state.voiceChannelsFor(server.id).map((vc) => VoiceChannelTile(channel: vc, onTap: () {})),
            ],
          ),
        ),
      ],
    );
  }
}