import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:mobile/app_state.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/services/socket_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// InviteOptionsSheet — invite friends directly or manage invite links
// ─────────────────────────────────────────────────────────────────────────────

class InviteOptionsSheet extends StatefulWidget {
  final ServerModel server;
  final List<FriendModel> friends;
  final VoidCallback onManageLinks;
  final SocketService socket;

  const InviteOptionsSheet({
    super.key,
    required this.server,
    required this.friends,
    required this.onManageLinks,
    required this.socket,
  });

  @override
  State<InviteOptionsSheet> createState() => _InviteOptionsSheetState();
}

class _InviteOptionsSheetState extends State<InviteOptionsSheet> {
  final Set<String> _invited = {};
  final Set<String> _inviting = {};
  final TextEditingController _searchCtrl = TextEditingController();
  List<dynamic> _serverMembers = [];
  bool _loadingMembers = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadMembers();
    _searchCtrl.addListener(() {
      setState(() => _searchQuery = _searchCtrl.text.toLowerCase().trim());
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMembers() async {
    try {
      final response = await ApiService.getServerMemberIds(widget.server.id);
      setState(() {
        _serverMembers = response;
        _loadingMembers = false;
      });
    } catch (_) {
      setState(() => _loadingMembers = false);
    }
  }

  Future<void> _inviteFriend(FriendModel friend) async {
    final state = context.read<SyncordAppState>();
    setState(() => _inviting.add(friend.id));
    try {
      final inviteResult =
          await ApiService.createPersonalInvite(widget.server.id, friend.id);
      final linkCode =
          inviteResult['linkCode']?.toString() ?? inviteResult['_id']?.toString() ?? '';

      if (linkCode.isEmpty) {
        _showSnack('Failed to create invite', isError: true);
        return;
      }

      final meta = {
        'type': 'serverInvite',
        'serverName': widget.server.name,
        'linkCode': linkCode,
        'serverId': widget.server.id,
      };
      final content =
          '${friend.username}, you\'ve been invited to join ${widget.server.name}!';

      final savedMsg = await state.sendDMMessage(
        friend.id,
        content,
        state.username,
        metadata: meta,
      );

      if (savedMsg != null) {
        widget.socket.sendDM(friend.id, savedMsg);
      }

      setState(() => _invited.add(friend.id));
    } catch (e) {
      _showSnack('Failed to invite ${friend.username}', isError: true);
    } finally {
      setState(() => _inviting.remove(friend.id));
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? const Color(0xFFED4245) : const Color(0xFF23A559),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final memberIds = _serverMembers.map((m) {
      if (m is String) return m;
      if (m is Map) return (m['_id'] ?? m['userId'] ?? '').toString();
      return '';
    }).toSet();

    final filtered = widget.friends.where((f) {
      if (_searchQuery.isNotEmpty && !f.username.toLowerCase().contains(_searchQuery)) {
        return false;
      }
      return true;
    }).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (ctx, scrollController) => Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF4E5058),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Invite to Server',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700)),
                      Text(widget.server.name,
                          style: const TextStyle(color: Color(0xFF949BA4), fontSize: 13)),
                    ],
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: widget.onManageLinks,
                  icon: const Icon(Icons.link, size: 16),
                  label: const Text('Links'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF5865F2),
                    side: const BorderSide(color: Color(0xFF5865F2)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    textStyle: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          // Search
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search friends',
                hintStyle: const TextStyle(color: Color(0xFF6D6F78), fontSize: 14),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF6D6F78), size: 18),
                filled: true,
                fillColor: const Color(0xFF1E1F22),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(height: 4),
          // Friends list
          Expanded(
            child: _loadingMembers && widget.friends.isEmpty
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF5865F2)))
                : filtered.isEmpty
                    ? const Center(
                        child: Text('No friends to invite',
                            style: TextStyle(color: Color(0xFF949BA4))))
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final f = filtered[i];
                          final alreadyMember = memberIds.contains(f.id);
                          final isInvited = _invited.contains(f.id);
                          final isInviting = _inviting.contains(f.id);

                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: const Color(0xFF5865F2),
                              child: Text(f.username[0].toUpperCase(),
                                  style: const TextStyle(
                                      color: Colors.white, fontWeight: FontWeight.bold)),
                            ),
                            title: Text(f.username,
                                style: const TextStyle(
                                    color: Colors.white, fontWeight: FontWeight.w500)),
                            subtitle: Text(
                              alreadyMember
                                  ? 'Already a member'
                                  : f.online
                                      ? 'Online'
                                      : 'Offline',
                              style: TextStyle(
                                  color: alreadyMember
                                      ? const Color(0xFF949BA4)
                                      : f.online
                                          ? const Color(0xFF23A559)
                                          : const Color(0xFF6D6F78),
                                  fontSize: 12),
                            ),
                            trailing: alreadyMember
                                ? const Text('Member',
                                    style: TextStyle(color: Color(0xFF949BA4), fontSize: 12))
                                : isInvited
                                    ? const Text('Sent ✓',
                                        style: TextStyle(
                                            color: Color(0xFF23A559),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600))
                                    : SizedBox(
                                        height: 32,
                                        child: ElevatedButton(
                                          onPressed:
                                              isInviting ? null : () => _inviteFriend(f),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF5865F2),
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 14),
                                            textStyle: const TextStyle(fontSize: 13),
                                          ),
                                          child: isInviting
                                              ? const SizedBox(
                                                  width: 14,
                                                  height: 14,
                                                  child: CircularProgressIndicator(
                                                      strokeWidth: 2, color: Colors.white))
                                              : const Text('Invite'),
                                        ),
                                      ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ManageLinksSheet — view/generate/revoke invite links
// ─────────────────────────────────────────────────────────────────────────────

class ManageLinksSheet extends StatefulWidget {
  final ServerModel server;
  const ManageLinksSheet({super.key, required this.server});

  @override
  State<ManageLinksSheet> createState() => _ManageLinksSheetState();
}

class _ManageLinksSheetState extends State<ManageLinksSheet> {
  List<Map<String, dynamic>> _links = [];
  bool _loading = true;
  bool _creating = false;
  String? _error;
  String? _revokingId;

  @override
  void initState() {
    super.initState();
    _loadLinks();
  }

  Future<void> _loadLinks() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService.getInvites(widget.server.id);
      setState(() {
        _links = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load invite links';
        _loading = false;
      });
    }
  }

  Future<void> _createLink() async {
    setState(() => _creating = true);
    final result = await ApiService.createInvite(widget.server.id);
    if (!mounted) return;
    if (result.containsKey('error')) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(result['error']), backgroundColor: const Color(0xFFED4245)));
    } else {
      await _loadLinks();
    }
    setState(() => _creating = false);
  }

  Future<void> _revokeLink(String linkCode) async {
    setState(() => _revokingId = linkCode);
    final result = await ApiService.revokeInvite(widget.server.id, linkCode);
    if (!mounted) return;
    if (result.containsKey('error')) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(result['error']), backgroundColor: const Color(0xFFED4245)));
    } else {
      await _loadLinks();
    }
    setState(() => _revokingId = null);
  }

  String _formatExpiry(dynamic expiresAt) {
    if (expiresAt == null) return 'Never';
    final dt = DateTime.tryParse(expiresAt.toString());
    if (dt == null) return 'Never';
    final diff = dt.difference(DateTime.now());
    if (diff.isNegative) return 'Expired';
    if (diff.inDays == 0) return 'Expires today';
    if (diff.inDays == 1) return 'Expires tomorrow';
    return '${diff.inDays} days';
  }

  bool _isDisabled(Map<String, dynamic> link) {
    if (link['isRevoked'] == true) return true;
    final exp = link['expiresAt'];
    if (exp != null) {
      final dt = DateTime.tryParse(exp.toString());
      if (dt != null && dt.isBefore(DateTime.now())) return true;
    }
    final maxUses = link['maxUses'];
    final currentUses = link['currentUses'] ?? 0;
    if (maxUses != null && currentUses >= maxUses) return true;
    return false;
  }

  void _showRevokeConfirm(String linkCode) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Invite?', style: TextStyle(color: Colors.white)),
        content: const Text('This link will stop working immediately.',
            style: TextStyle(color: Color(0xFFB5BAC1))),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _revokeLink(linkCode);
            },
            child: const Text('Delete', style: TextStyle(color: Color(0xFFED4245))),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (ctx, scrollCtrl) => Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 4),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF4E5058),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                const Expanded(
                  child: Text('Invite Links',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700)),
                ),
                ElevatedButton.icon(
                  onPressed: _creating ? null : _createLink,
                  icon: _creating
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.add, size: 16),
                  label: const Text('New Link'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF5865F2),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    textStyle: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFF3F4147)),
          // Content
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF5865F2)))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(_error!,
                                style: const TextStyle(color: Color(0xFF949BA4))),
                            const SizedBox(height: 12),
                            TextButton(
                                onPressed: _loadLinks, child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _links.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.link_off,
                                    color: Color(0xFF949BA4), size: 40),
                                const SizedBox(height: 12),
                                const Text('No invite links yet.',
                                    style: TextStyle(color: Color(0xFF949BA4))),
                                const SizedBox(height: 16),
                                ElevatedButton.icon(
                                  onPressed: _creating ? null : _createLink,
                                  icon: const Icon(Icons.add, size: 16),
                                  label: const Text('Create First Link'),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            controller: scrollCtrl,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            itemCount: _links.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1, color: Color(0xFF3F4147)),
                            itemBuilder: (ctx, i) {
                              final link = _links[i];
                              final code = link['_id']?.toString() ?? '';
                              final fullLink = 'syncord.space/join/$code';
                              final disabled = _isDisabled(link);
                              final currentUses = link['currentUses'] ?? 0;
                              final maxUses = link['maxUses'];
                              final isRevoking = _revokingId == code;

                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  fullLink,
                                                  style: TextStyle(
                                                    color: disabled
                                                        ? const Color(0xFF4E5058)
                                                        : Colors.white,
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                              if (!disabled)
                                                GestureDetector(
                                                  onTap: () {
                                                    Clipboard.setData(
                                                        ClipboardData(text: fullLink));
                                                    ScaffoldMessenger.of(context)
                                                        .showSnackBar(
                                                      const SnackBar(
                                                          content: Text('Copied!'),
                                                          backgroundColor:
                                                              Color(0xFF23A559)),
                                                    );
                                                  },
                                                  child: const Padding(
                                                    padding: EdgeInsets.only(left: 6),
                                                    child: Icon(Icons.copy,
                                                        color: Color(0xFF5865F2),
                                                        size: 16),
                                                  ),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Row(
                                            children: [
                                              Text(
                                                maxUses != null
                                                    ? '$currentUses/$maxUses uses'
                                                    : '$currentUses uses',
                                                style: const TextStyle(
                                                    color: Color(0xFF949BA4),
                                                    fontSize: 12),
                                              ),
                                              const Text(' · ',
                                                  style:
                                                      TextStyle(color: Color(0xFF4E5058))),
                                              Text(
                                                link['isRevoked'] == true
                                                    ? 'Revoked'
                                                    : _formatExpiry(link['expiresAt']),
                                                style: TextStyle(
                                                  color: disabled
                                                      ? const Color(0xFFED4245)
                                                      : const Color(0xFF949BA4),
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    if (!disabled)
                                      SizedBox(
                                        height: 32,
                                        child: OutlinedButton(
                                          onPressed: isRevoking
                                              ? null
                                              : () => _showRevokeConfirm(code),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: const Color(0xFFED4245),
                                            side: const BorderSide(
                                                color: Color(0xFFED4245)),
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 12),
                                            textStyle: const TextStyle(fontSize: 12),
                                          ),
                                          child: isRevoking
                                              ? const SizedBox(
                                                  width: 12,
                                                  height: 12,
                                                  child: CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                      color: Color(0xFFED4245)))
                                              : const Text('Delete'),
                                        ),
                                      ),
                                    if (disabled)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF1E1F22),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text('Inactive',
                                            style: TextStyle(
                                                color: Color(0xFF4E5058), fontSize: 12)),
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
