import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile/app_state.dart';
import 'package:mobile/services/socket_service.dart';
import 'package:mobile/login.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomeDialogs {
  static void showCreateServer(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create a Server'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(hintText: 'Server Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(onPressed: () {
            context.read<SyncordAppState>().createServer(ctrl.text);
            Navigator.pop(ctx);
          }, child: const Text('Create')),
        ],
      ),
    );
  }

  static void showCreateChannel(BuildContext context, String serverId, bool isVoice) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isVoice ? 'Create Voice Channel' : 'Create Text Channel'),
        content: TextField(controller: ctrl),
        actions: [
          ElevatedButton(onPressed: () {
            if (isVoice) {
              context.read<SyncordAppState>().createVoiceChannel(serverId, ctrl.text);
            } else {
              context.read<SyncordAppState>().createTextChannel(serverId, ctrl.text);
            }
            Navigator.pop(ctx);
          }, child: const Text('Create')),
        ],
      ),
    );
  }

  static void showAddFriend(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Add Friend"),
        content: TextField(controller: ctrl),
        actions: [
          ElevatedButton(onPressed: () {
            context.read<SyncordAppState>().addFriendByUsername(ctrl.text);
            Navigator.pop(ctx);
          }, child: const Text("Send Request")),
        ],
      ),
    );
  }

  static void showLogoutConfirm(BuildContext context, SocketService socket) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Logout?"),
        actions: [
          TextButton(onPressed: () async {
            final prefs = await SharedPreferences.getInstance();
            await prefs.clear();
            socket.disconnect();
            if (context.mounted) Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginPage()), (r) => false);
          }, child: const Text("Logout", style: TextStyle(color: Colors.red))),
        ],
      ),
    );
  }
}