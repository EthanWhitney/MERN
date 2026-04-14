import 'package:flutter/material.dart';
import 'package:mobile/models/friend_model.dart';
import 'package:mobile/models/server_model.dart';

class ServerIcon extends StatelessWidget {
  final IconData? icon;
  final String? label;
  final String? tooltip;
  final bool isActive;
  final VoidCallback onTap;
  const ServerIcon({super.key, this.icon, this.label, this.tooltip, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    Widget child = GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        height: 48,
        width: 48,
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF5865F2) : const Color(0xFF313338),
          borderRadius: BorderRadius.circular(isActive ? 16 : 24),
        ),
        child: Center(
          child: icon != null
              ? Icon(icon, color: isActive ? Colors.white : const Color(0xFF949BA4), size: 22)
              : Text(label ?? '?',
                  style: TextStyle(
                      color: isActive ? Colors.white : const Color(0xFFDCDEE0),
                      fontWeight: FontWeight.w700,
                      fontSize: 16)),
        ),
      ),
    );
    if (tooltip != null) return Tooltip(message: tooltip!, child: child);
    return child;
  }
}

class RailDivider extends StatelessWidget {
  const RailDivider({super.key});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        height: 2,
        decoration: BoxDecoration(
            color: const Color(0xFF313338), borderRadius: BorderRadius.circular(1)),
      );
}

class ChannelTile extends StatelessWidget {
  final TextChannel channel;
  final bool isActive;
  final VoidCallback onTap;
  const ChannelTile({super.key, required this.channel, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF3C3F45) : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            children: [
              const Text('#', style: TextStyle(color: Color(0xFF949BA4), fontSize: 18)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(channel.name,
                    style: TextStyle(
                        color: isActive ? const Color(0xFFDCDEE0) : const Color(0xFF949BA4),
                        fontSize: 15)),
              ),
            ],
          ),
        ),
      );
}

class FriendTile extends StatelessWidget {
  final FriendModel friend;
  final VoidCallback onTap;
  const FriendTile({super.key, required this.friend, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: const Color(0xFF5865F2),
                    child: Text(friend.username[0].toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: friend.online ? const Color(0xFF23A559) : const Color(0xFF80848E),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF2B2D31), width: 2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(friend.username,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    Text(friend.online ? 'Online' : 'Offline',
                        style: TextStyle(
                            color: friend.online
                                ? const Color(0xFF23A559)
                                : const Color(0xFF949BA4),
                            fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chat_bubble_outline, color: Color(0xFF949BA4), size: 18),
            ],
          ),
        ),
      );
}

class FriendsTab extends StatelessWidget {
  final String label;
  final bool isActive;
  final int count;
  final VoidCallback onTap;
  const FriendsTab(
      {super.key,
      required this.label,
      required this.isActive,
      this.count = 0,
      required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF3C3F45) : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            children: [
              Text(label,
                  style: TextStyle(
                      color: isActive ? Colors.white : const Color(0xFF949BA4),
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
              if (count > 0) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                      color: const Color(0xFFED4245),
                      borderRadius: BorderRadius.circular(10)),
                  child: Text('$count',
                      style: const TextStyle(
                          color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ],
          ),
        ),
      );
}

class RequestTile extends StatelessWidget {
  final FriendModel friend;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  const RequestTile(
      {super.key, required this.friend, required this.onAccept, required this.onDecline});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
              color: const Color(0xFF1E1F22), borderRadius: BorderRadius.circular(6)),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: const Color(0xFF5865F2),
                child: Text(friend.username[0].toUpperCase(),
                    style: const TextStyle(color: Colors.white)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(friend.username,
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w600)),
                    const Text('Incoming friend request',
                        style: TextStyle(color: Color(0xFF949BA4), fontSize: 11)),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.check_circle, color: Color(0xFF23A559), size: 22),
                onPressed: onAccept,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
              IconButton(
                icon: const Icon(Icons.cancel, color: Color(0xFFED4245), size: 22),
                onPressed: onDecline,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
            ],
          ),
        ),
      );
}

class FriendCard extends StatelessWidget {
  final FriendModel friend;
  final VoidCallback onTap;
  const FriendCard({super.key, required this.friend, required this.onTap});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: const Color(0xFF2B2D31), borderRadius: BorderRadius.circular(8)),
            child: Row(
              children: [
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: const Color(0xFF5865F2),
                      child: Text(friend.username[0].toUpperCase(),
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16)),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: friend.online
                              ? const Color(0xFF23A559)
                              : const Color(0xFF80848E),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF2B2D31), width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(friend.username,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 15)),
                      const SizedBox(height: 2),
                      Text(friend.online ? '● Online' : '● Offline',
                          style: TextStyle(
                              color: friend.online
                                  ? const Color(0xFF23A559)
                                  : const Color(0xFF80848E),
                              fontSize: 12)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Color(0xFF949BA4)),
              ],
            ),
          ),
        ),
      );
}

class PendingRequestsBanner extends StatelessWidget {
  final int count;
  final VoidCallback onTap;
  const PendingRequestsBanner({super.key, required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF5865F2).withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF5865F2).withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration:
                    const BoxDecoration(color: Color(0xFFED4245), shape: BoxShape.circle),
                child: Text('$count',
                    style: const TextStyle(
                        color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 10),
              const Text('Pending friend requests',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500)),
              const Spacer(),
              const Icon(Icons.arrow_forward_ios, color: Color(0xFF949BA4), size: 14),
            ],
          ),
        ),
      );
}

class SectionHeader extends StatelessWidget {
  final String label;
  final VoidCallback? onAdd;
  const SectionHeader({super.key, required this.label, this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                  color: Color(0xFF949BA4),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5),
            ),
          ),
          if (onAdd != null)
            GestureDetector(
              onTap: onAdd,
              child: const Icon(Icons.add, color: Color(0xFF949BA4), size: 18),
            ),
        ],
      ),
    );
  }
}

class VoiceChannelTile extends StatelessWidget {
  final VoiceChannel channel;
  final VoidCallback onTap;
  const VoiceChannelTile({super.key, required this.channel, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(4)),
        child: Row(
          children: [
            const Icon(Icons.volume_up, color: Color(0xFF949BA4), size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                channel.name,
                style: const TextStyle(color: Color(0xFF949BA4), fontSize: 15),
              ),
            ),
            const Icon(Icons.phone_in_talk, color: Color(0xFF23A559), size: 16),
          ],
        ),
      ),
    );
  }
}
