import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/app_state.dart';
import 'package:mobile/services/socket_service.dart'; 
import 'package:mobile/login.dart';

class HomePage extends StatefulWidget {
  final String username;
  final String userId;

  const HomePage({super.key, required this.username, required this.userId});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final SocketService _socketService = SocketService();

  @override
  void initState() {
    super.initState();
    _socketService.connect(widget.userId);
    // Load servers into the global state
    Provider.of<SyncordAppState>(context, listen: false).loadServers();
  }

  Future<void> _logout() async {
    try {
      // 1. Clear local storage (Tokens)
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();

      // 2. Disconnect Socket
      _socketService.disconnect();

      // 3. Navigate back to Login
      if (!mounted) return;
      
      // This removes all previous pages from the stack and starts fresh at Login
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (context) => const LoginPage()),
        (Route<dynamic> route) => false,
      );
      
      print("Logout successful: Tokens cleared and navigating to Login.");
    } catch (e) {
      print("Logout Error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<SyncordAppState>(context);
    
    return Scaffold(
      backgroundColor: const Color(0xFF313338),
      appBar: AppBar(
        title: Text(appState.currentMode == ViewMode.dm ? "Direct Messages" : (appState.selectedServer?.name ?? "Syncord")),
        backgroundColor: const Color(0xFF313338),
      ),
      drawer: Drawer(
        width: MediaQuery.of(context).size.width * 0.85,
        backgroundColor: Colors.transparent,
        child: Row(
          children: [
            // 1. FAR LEFT RAIL (Servers & DM Toggle)
            Container(
              width: 72,
              color: const Color(0xFF1E1F22),
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  // DM Button
                  _buildSidebarIcon(
                    icon: Icons.chat_bubble,
                    isActive: appState.currentMode == ViewMode.dm,
                    onTap: () => appState.setViewMode(ViewMode.dm),
                  ),
                  const Divider(color: Colors.white10, indent: 20, endIndent: 20),
                  // Server List
                  Expanded(
                    child: Consumer<SyncordAppState>(
                      builder: (context, state, child) {
                        return ListView.builder(
                          itemCount: state.servers.length + 1,
                          itemBuilder: (context, index) {
                            if (index == state.servers.length) {
                              return _buildSidebarIcon(
                                icon: Icons.add,
                                isActive: false,
                                onTap: () => _showCreateServerDialog(state),
                              );
                            }
                            final server = state.servers[index];
                            return _buildSidebarIcon(
                              text: server.name[0].toUpperCase(),
                              isActive: state.selectedServer?.id == server.id,
                              onTap: () => state.selectServer(server),
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            // 2. MIDDLE COLUMN (Channels or DM List)
            Expanded(
              child: Container(
                color: const Color(0xFF2B2D31),
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    Expanded(
                      child: appState.currentMode == ViewMode.dm 
                        ? _buildDmList() 
                        : _buildChannelList(appState),
                    ),
                    // 3. ACCOUNT INFO & SETTINGS
                    _buildAccountBar(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      body: Center(
        child: Text(
          appState.currentMode == ViewMode.dm ? "Friends/DM View" : "Chat in #${appState.selectedServer?.name}",
          style: const TextStyle(color: Colors.white),
        ),
      ),
    );
  }

  Widget _buildSidebarIcon({IconData? icon, String? text, required bool isActive, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        height: 48,
        width: 48,
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF5865F2) : const Color(0xFF313338),
          borderRadius: BorderRadius.circular(isActive ? 16 : 24),
        ),
        child: Center(
          child: icon != null 
            ? Icon(icon, color: Colors.white) 
            : Text(text!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }

  Widget _buildDmList() {
    return ListView(
      children: [
        ListTile(leading: Icon(Icons.people, color: Colors.white70), title: Text("Friends", style: TextStyle(color: Colors.white))),
        ListTile(
          onTap: () => _showAddFriendDialog(),
          leading: const CircleAvatar(
            backgroundColor: Color(0xFF23A559), // Discord Green
            child: Icon(Icons.person_add, color: Colors.white, size: 20),
          ),
          title: const Text("Add Friend", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        Padding(padding: EdgeInsets.all(16), child: Text("DIRECT MESSAGES", style: TextStyle(color: Color(0xFF949BA4), fontSize: 12, fontWeight: FontWeight.bold))),
        // Add your dynamic DM/Chat list here later
      ],
    );
  }

  void _showCreateServerDialog(SyncordAppState state) {
    final TextEditingController nameController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Create a Server"),
        content: TextField(
          controller: nameController,
          decoration: const InputDecoration(hintText: "Server Name"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          ElevatedButton(
            onPressed: () async {
              print("UI: 'Create' button tapped.");
              final String name = nameController.text.trim();
              if (name.isEmpty) {
                print("UI: Name is empty, ignoring.");
                return;
              }

              try {
                print("UI: Calling appState.createServer with '$name'...");
                await state.createServer(name); 
                
                print("UI: appState.createServer finished. Closing dialog...");
                if (mounted) {
                  Navigator.pop(context);
                }
              } catch (e) {
                print("UI ERROR: Caught error in dialog: $e");
                // Optional: show a snackbar so you see the error on the phone
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: const Text("Create"),
          ),
        ],
      ),
    );
  }

  void _showAddFriendDialog() {
    final TextEditingController friendController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Add Friend"),
        content: TextField(
          controller: friendController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: "Enter username",
            prefixIcon: Icon(Icons.person_add, color: Colors.white54),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            onPressed: () async {
              final String name = friendController.text.trim();
              if (name.isEmpty) return;

              final res = await ApiService.addFriend(name);
              
              if (!mounted) return;
              Navigator.pop(context); // Close dialog

              if (res.containsKey('error')) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(res['error']), backgroundColor: Colors.red),
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Friend request sent!"), backgroundColor: Colors.green),
                );
              }
            },
            child: const Text("Add"),
          ),
        ],
      ),
    );
}

  Widget _buildChannelList(SyncordAppState state) {
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(state.selectedServer?.name.toUpperCase() ?? "", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        const ListTile(leading: Text("#", style: TextStyle(color: Colors.white54, fontSize: 20)), title: Text("general", style: TextStyle(color: Colors.white70))),
      ],
    );
  }

  Widget _buildAccountBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      color: const Color(0xFF232428),
      child: Row(
        children: [
          CircleAvatar(radius: 16, child: Text(widget.username[0].toUpperCase())),
          const SizedBox(width: 8),
          Expanded(child: Text(widget.username, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, overflow: TextOverflow.ellipsis))),
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white70),
            onPressed: () => _showSettingsDialog(),
          ),
        ],
      ),
    );
  }

  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Settings"),
        content: const Text("Would you like to logout?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          TextButton(onPressed: _logout, child: const Text("Logout", style: TextStyle(color: Colors.red))),
        ],
      ),
    );
  }
}



