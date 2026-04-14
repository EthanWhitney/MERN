import 'package:flutter/material.dart';
import 'package:mobile/app_state.dart';
import 'home_components.dart';

class ServerRail extends StatelessWidget {
  final SyncordAppState state;
  final VoidCallback onCreateServer;
  final Function(ServerModel) onSelectServer;

  const ServerRail({super.key, required this.state, required this.onCreateServer, required this.onSelectServer});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 72,
      color: const Color(0xFF1E1F22),
      child: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 8),
            ServerIcon(
              icon: Icons.chat_bubble_rounded,
              isActive: state.currentMode == ViewMode.dm,
              onTap: () => state.setViewMode(ViewMode.dm),
            ),
            const RailDivider(),
            Expanded(
              child: ListView.builder(
                padding: EdgeInsets.zero,
                itemCount: state.servers.length + 1,
                itemBuilder: (ctx, i) {
                  if (i == state.servers.length) {
                    return ServerIcon(icon: Icons.add, isActive: false, onTap: onCreateServer);
                  }
                  final server = state.servers[i];
                  return ServerIcon(
                    label: server.name[0].toUpperCase(),
                    tooltip: server.name,
                    isActive: state.selectedServer?.id == server.id,
                    onTap: () => onSelectServer(server),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}