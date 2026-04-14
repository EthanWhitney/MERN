import 'package:flutter/material.dart';
import 'package:mobile/app_state.dart';

class HomeAppBar extends StatelessWidget implements PreferredSizeWidget {
  final SyncordAppState state;
  final bool isServer;
  final VoidCallback onOpenDrawer;
  final VoidCallback onShowInvite;

  const HomeAppBar({super.key, required this.state, required this.isServer, required this.onOpenDrawer, required this.onShowInvite});

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: const Color(0xFF313338),
      leading: IconButton(icon: const Icon(Icons.menu), onPressed: onOpenDrawer),
      title: Text(isServer ? (state.selectedServer?.name ?? 'Syncord') : 'Friends'),
      actions: [
        if (isServer && state.selectedServer != null)
          IconButton(icon: const Icon(Icons.link), onPressed: onShowInvite),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class AccountBar extends StatelessWidget {
  final String username;
  final VoidCallback onLogout;
  const AccountBar({super.key, required this.username, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      color: const Color(0xFF232428),
      child: Row(
        children: [
          CircleAvatar(backgroundColor: Colors.indigo, child: Text(username[0].toUpperCase())),
          const SizedBox(width: 8),
          Expanded(child: Text(username, style: const TextStyle(color: Colors.white))),
          IconButton(icon: const Icon(Icons.settings, color: Colors.grey), onPressed: onLogout),
        ],
      ),
    );
  }
}

class ServerIcon extends StatelessWidget {
  final IconData? icon;
  final String? label;
  final String? tooltip;
  final bool isActive;
  final VoidCallback onTap;
  const ServerIcon({super.key, this.icon, this.label, this.tooltip, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        height: 48, width: 48,
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF5865F2) : const Color(0xFF313338),
          borderRadius: BorderRadius.circular(isActive ? 16 : 24),
        ),
        child: Center(
          child: icon != null 
            ? Icon(icon, color: isActive ? Colors.white : const Color(0xFF949BA4))
            : Text(label!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }
}

class RailDivider extends StatelessWidget {
  const RailDivider({super.key});
  @override
  Widget build(BuildContext context) => Container(height: 2, width: 32, color: const Color(0xFF313338), margin: const EdgeInsets.symmetric(vertical: 8));
}

class SectionHeader extends StatelessWidget {
  final String label;
  final VoidCallback onAdd;
  const SectionHeader({super.key, required this.label, required this.onAdd});
  @override
  Widget build(BuildContext context) => ListTile(
    title: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
    trailing: IconButton(icon: const Icon(Icons.add, size: 18), onPressed: onAdd),
    dense: true,
  );
}

class ChannelTile extends StatelessWidget {
  final TextChannel channel;
  final bool isActive;
  final VoidCallback onTap;
  const ChannelTile({super.key, required this.channel, required this.isActive, required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
    leading: const Text("#", style: TextStyle(color: Colors.grey, fontSize: 20)),
    title: Text(channel.name, style: TextStyle(color: isActive ? Colors.white : Colors.grey)),
    onTap: onTap,
    dense: true,
  );
}

class VoiceChannelTile extends StatelessWidget {
  final VoiceChannel channel;
  final VoidCallback onTap;
  const VoiceChannelTile({super.key, required this.channel, required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
    leading: const Icon(Icons.volume_up, color: Colors.grey, size: 20),
    title: Text(channel.name, style: const TextStyle(color: Colors.grey)),
    dense: true,
  );
}

class FriendsTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final int count;
  final VoidCallback onTap;
  const FriendsTab({super.key, required this.label, required this.isActive, this.count = 0, required this.onTap});
  @override
  Widget build(BuildContext context) => TextButton(onPressed: onTap, child: Text(count > 0 ? "$label ($count)" : label, style: TextStyle(color: isActive ? Colors.white : Colors.grey)));
}

class FriendTile extends StatelessWidget {
  final FriendModel friend;
  final VoidCallback onTap;
  const FriendTile({super.key, required this.friend, required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
    leading: CircleAvatar(child: Text(friend.username[0])),
    title: Text(friend.username, style: const TextStyle(color: Colors.white)),
    subtitle: Text(friend.online ? "Online" : "Offline", style: TextStyle(color: friend.online ? Colors.green : Colors.grey)),
    onTap: onTap,
  );
}

class RequestTile extends StatelessWidget {
  final FriendModel friend;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  const RequestTile({super.key, required this.friend, required this.onAccept, required this.onDecline});
  @override
  Widget build(BuildContext context) => ListTile(
    title: Text(friend.username, style: const TextStyle(color: Colors.white)),
    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
      IconButton(icon: const Icon(Icons.check, color: Colors.green), onPressed: onAccept),
      IconButton(icon: const Icon(Icons.close, color: Colors.red), onPressed: onDecline),
    ]),
  );
}