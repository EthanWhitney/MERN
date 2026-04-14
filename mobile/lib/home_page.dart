import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile/app_state.dart';
import 'package:mobile/services/socket_service.dart';
import 'package:mobile/services/voice_service.dart';
import 'package:mobile/pages/chat_page.dart';
import 'package:mobile/widgets/server_rail.dart';
import 'package:mobile/widgets/channel_panel.dart';
import 'package:mobile/widgets/friends_panel.dart';
import 'package:mobile/widgets/home_dialogs.dart';
import 'package:mobile/widgets/home_components.dart';
import 'package:mobile/widgets/invite_management.dart';

class HomePage extends StatefulWidget {
  final String username;
  final String userId;
  const HomePage({super.key, required this.username, required this.userId});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final SocketService _socket = SocketService();
  late final VoiceService _voiceService;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  String _friendsTab = 'all';

  @override
  void initState() {
    super.initState();
    final state = context.read<SyncordAppState>();
    state.setUserInfo(widget.userId, widget.username);
    _voiceService = VoiceService();

    // Initialize Socket Connection
    _socket.connect(
      widget.userId,
      onConnected: () => _joinAllDMRooms(state),
      onFriendRequest: (_) => state.loadFriends(),
      onFriendAccepted: (_) => state.loadFriends().then((_) => _joinAllDMRooms(state)),
      onFriendDeclined: (_) => state.loadFriends(),
      onUserOnline: (data) => state.setFriendOnline(data['userId']?.toString() ?? '', true),
      onUserOffline: (data) => state.setFriendOnline(data['userId']?.toString() ?? '', false),
    );

    _socket.addMessageListener((raw) => state.handleIncomingMessage(raw, myUserId: widget.userId));
    
    // Initial Data Load
    state.loadServers();
    state.loadFriends().then((_) => _joinAllDMRooms(state));
  }

  void _joinAllDMRooms(SyncordAppState state) {
    for (final friend in state.friends) {
      _socket.joinDMPassive(friend.id);
    }
  }

  @override
  void dispose() {
    _voiceService.dispose();
    _socket.disconnect();
    super.dispose();
  }

  // --- Navigation & Logic Handlers ---

  void _handleServerSelection(ServerModel server) {
    final state = context.read<SyncordAppState>();
    state.selectServer(server);
    
    final channels = state.channelsFor(server.id);
    if (channels.isNotEmpty) {
      // Logic: Navigate to the first text channel automatically
      _openChannelChat(server, channels.first);
    } else {
      // Fallback: If no channels, just open the drawer to let them create one
      _scaffoldKey.currentState?.openDrawer();
    }
  }

  void _openDMChat(FriendModel friend) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ChatPage.dm(
        title: friend.username, 
        friendId: friend.id, 
        socket: _socket
      ),
    ));
  }

  void _openChannelChat(ServerModel server, TextChannel channel) {
    _socket.joinServerChannel(server.id, channel.id);
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ChatPage.channel(
        title: channel.name, 
        serverId: server.id, 
        channelId: channel.id, 
        socket: _socket
      ),
    )).then((_) => _socket.leaveServerChannel(server.id, channel.id));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<SyncordAppState>();
    final isServer = state.currentMode == ViewMode.server;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFF313338),
      appBar: HomeAppBar(
        state: state,
        isServer: isServer,
        onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer(),
        onShowInvite: () => InviteManagement.showInviteOptions(context, state.selectedServer!, _socket),
      ),
      drawer: Drawer(
        width: MediaQuery.of(context).size.width * 0.85,
        backgroundColor: Colors.transparent,
        child: Row(
          children: [
            // Left Rail for Server Selection
            ServerRail(
              state: state,
              onCreateServer: () => HomeDialogs.showCreateServer(context),
              onSelectServer: _handleServerSelection,
            ),
            // Middle Panel for Channels or DM List
            Expanded(
              child: Container(
                color: const Color(0xFF2B2D31),
                child: Column(
                  children: [
                    const SizedBox(height: 48), // Top padding for status bar
                    Expanded(
                      child: isServer
                          ? ChannelPanel(
                              state: state,
                              onSelectChannel: (ch) => _openChannelChat(state.selectedServer!, ch),
                              onCreateText: (sid) => HomeDialogs.showCreateChannel(context, sid, false),
                              onCreateVoice: (sid) => HomeDialogs.showCreateChannel(context, sid, true),
                              onShowInvite: (s) => InviteManagement.showInviteOptions(context, s, _socket),
                            )
                          : FriendsPanel(
                              state: state,
                              currentTab: _friendsTab,
                              onTabChange: (t) => setState(() => _friendsTab = t),
                              onOpenChat: _openDMChat,
                              onAddFriend: () => HomeDialogs.showAddFriend(context),
                            ),
                    ),
                    AccountBar(
                      username: widget.username, 
                      onLogout: () => HomeDialogs.showLogoutConfirm(context, _socket)
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      // Main Body: Now primarily serves as the Friends landing page
      body: isServer 
        ? const Center(child: Text("Swipe right to open channels", style: TextStyle(color: Color(0xFF949BA4))))
        : FriendsPanel(
            state: state,
            currentTab: _friendsTab,
            onTabChange: (t) => setState(() => _friendsTab = t),
            onOpenChat: _openDMChat,
            onAddFriend: () => HomeDialogs.showAddFriend(context),
          ),
    );
  }
}