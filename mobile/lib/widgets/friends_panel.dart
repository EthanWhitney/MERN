import 'package:flutter/material.dart';
import 'package:mobile/app_state.dart';
import 'home_components.dart';

class FriendsPanel extends StatelessWidget {
  final SyncordAppState state;
  final String currentTab;
  final Function(String) onTabChange;
  final Function(FriendModel) onOpenChat;
  final VoidCallback onAddFriend;

  const FriendsPanel({
    super.key,
    required this.state,
    required this.currentTab,
    required this.onTabChange,
    required this.onOpenChat,
    required this.onAddFriend,
  });

  @override
  Widget build(BuildContext context) {
    // Filter friends based on online status for the "All" (Online) tab
    final onlineFriends = state.friends.where((f) => f.online).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8.0),
          child: Row(
            children: [
              FriendsTab(
                label: 'Online', 
                isActive: currentTab == 'all', 
                count: onlineFriends.length,
                onTap: () => onTabChange('all')
              ),
              FriendsTab(
                label: 'Requests', 
                isActive: currentTab == 'requests', 
                count: state.pendingRequests.length, 
                onTap: () => onTabChange('requests')
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.person_add, color: Color(0xFF23A559)), 
                onPressed: onAddFriend
              ),
            ],
          ),
        ),
        const Divider(color: Color(0xFF1E1F22), height: 1),
        Expanded(
          child: currentTab == 'all' 
            ? _buildOnlineList(onlineFriends) 
            : _buildRequestsList(),
        ),
      ],
    );
  }

  Widget _buildOnlineList(List<FriendModel> onlineFriends) {
    if (onlineFriends.isEmpty) {
      return const Center(
        child: Text("No one is around to play...", 
          style: TextStyle(color: Color(0xFF949BA4)))
      );
    }
    return ListView.builder(
      itemCount: onlineFriends.length,
      itemBuilder: (ctx, i) => FriendTile(
        friend: onlineFriends[i], 
        onTap: () => onOpenChat(onlineFriends[i])
      ),
    );
  }

  Widget _buildRequestsList() {
    return ListView.builder(
      itemCount: state.pendingRequests.length,
      itemBuilder: (ctx, i) => RequestTile(
        friend: state.pendingRequests[i],
        onAccept: () => state.acceptFriendRequest(state.pendingRequests[i].id),
        onDecline: () => state.declineFriendRequest(state.pendingRequests[i].id),
      ),
    );
  }
}