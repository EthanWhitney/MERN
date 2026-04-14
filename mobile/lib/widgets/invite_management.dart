import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/app_state.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/services/socket_service.dart';
import 'package:provider/provider.dart';

class InviteManagement {
  static void showInviteOptions(BuildContext context, ServerModel server, SocketService socket) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF2B2D31),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => _InviteOptionsSheet(server: server, socket: socket),
    );
  }

  static void showManageLinks(BuildContext context, ServerModel server) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF2B2D31),
      builder: (ctx) => _ManageLinksSheet(server: server),
    );
  }
}

class _InviteOptionsSheet extends StatefulWidget {
  final ServerModel server;
  final SocketService socket;
  const _InviteOptionsSheet({required this.server, required this.socket});

  @override
  State<_InviteOptionsSheet> createState() => _InviteOptionsSheetState();
}

class _InviteOptionsSheetState extends State<_InviteOptionsSheet> {
  final Set<String> _invited = {};
  
  @override
  Widget build(BuildContext context) {
    final state = context.watch<SyncordAppState>();
    return Column(
      children: [
        const SizedBox(height: 12),
        ListTile(
          title: const Text("Invite Friends", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          trailing: TextButton(
            onPressed: () { Navigator.pop(context); InviteManagement.showManageLinks(context, widget.server); },
            child: const Text("Manage Links"),
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: state.friends.length,
            itemBuilder: (ctx, i) {
              final f = state.friends[i];
              return ListTile(
                title: Text(f.username, style: const TextStyle(color: Colors.white)),
                trailing: ElevatedButton(
                  onPressed: _invited.contains(f.id) ? null : () => _sendInvite(f, state),
                  child: Text(_invited.contains(f.id) ? "Sent" : "Invite"),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _sendInvite(FriendModel friend, SyncordAppState state) async {
    final invite = await ApiService.createPersonalInvite(widget.server.id, friend.id);
    final msg = await state.sendDMMessage(friend.id, "Join my server!", state.username, metadata: {
      'type': 'serverInvite',
      'serverName': widget.server.name,
      'linkCode': invite['linkCode'],
      'serverId': widget.server.id,
    });
    if (msg != null) widget.socket.sendDM(friend.id, msg);
    setState(() => _invited.add(friend.id));
  }
}

class _ManageLinksSheet extends StatelessWidget {
  final ServerModel server;
  const _ManageLinksSheet({required this.server});
  @override
  Widget build(BuildContext context) => const Center(child: Text("Manage Links Content")); 
}