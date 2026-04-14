import 'package:flutter/material.dart';

import 'package:provider/provider.dart';
import 'package:mobile/app_state.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/services/socket_service.dart';
import 'package:mobile/widgets/message_bubble.dart';

enum ChatType { dm, channel }

class ChatPage extends StatefulWidget {
  final ChatType chatType;
  final String title;
  final String? friendId;
  final String? serverId;
  final String? channelId;
  final SocketService socket;

  const ChatPage.dm({
    super.key,
    required this.title,
    required this.friendId,
    required this.socket,
  })  : chatType = ChatType.dm,
        serverId = null,
        channelId = null;

  const ChatPage.channel({
    super.key,
    required this.title,
    required this.serverId,
    required this.channelId,
    required this.socket,
  })  : chatType = ChatType.channel,
        friendId = null;

  String get cacheKey =>
      chatType == ChatType.dm ? 'dm_$friendId' : 'ch_$channelId';

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isSending = false;
  bool _loadingMore = false;

  // The socket message callback — stored so it can be removed on dispose
  late final void Function(Map<String, dynamic>) _onSocketMessage;

  @override
  void initState() {
    super.initState();

    _onSocketMessage = (raw) {
      final state = context.read<SyncordAppState>();
      state.handleIncomingMessage(raw, myUserId: state.userId);
      // Scroll to bottom when a new message arrives for this chat
      final key = widget.cacheKey;
      final msgs = state.messagesFor(key);
      if (msgs.isNotEmpty) _scrollToBottom();
    };

    widget.socket.addMessageListener(_onSocketMessage);

    // Join the appropriate socket room so real-time messages are delivered.
    // ChatPage owns the join/leave lifecycle — this ensures it works regardless
    // of how the page is opened (friend list, invite, deeplink, etc.).
    if (widget.chatType == ChatType.dm) {
      widget.socket.joinDM(widget.friendId!);
    } else {
      widget.socket.joinServerChannel(widget.serverId!, widget.channelId!);
    }

    _loadInitial();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    // Leave the room when we navigate away
    if (widget.chatType == ChatType.channel) {
      widget.socket.leaveServerChannel(widget.serverId!, widget.channelId!);
    }
    // No explicit leave for DM rooms — server handles cleanup on disconnect
    widget.socket.removeMessageListener(_onSocketMessage);
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  Future<void> _loadInitial() async {
    final state = context.read<SyncordAppState>();
    if (widget.chatType == ChatType.dm) {
      await state.loadDMMessages(widget.friendId!, refresh: true);
    } else {
      await state.loadChannelMessages(widget.serverId!, widget.channelId!,
          refresh: true);
    }
    _scrollToBottom();
  }

  void _onScroll() {
    if (_scrollController.position.pixels <= 120) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore) return;
    final state = context.read<SyncordAppState>();
    if (state.allMessagesLoaded(widget.cacheKey)) return;
    if (state.isMessagesLoading(widget.cacheKey)) return;

    setState(() => _loadingMore = true);
    final oldMax = _scrollController.position.maxScrollExtent;

    if (widget.chatType == ChatType.dm) {
      await state.loadDMMessages(widget.friendId!);
    } else {
      await state.loadChannelMessages(widget.serverId!, widget.channelId!);
    }

    // Restore scroll position after content prepended
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        final diff = _scrollController.position.maxScrollExtent - oldMax;
        _scrollController.jumpTo(_scrollController.offset + diff);
      }
      if (mounted) setState(() => _loadingMore = false);
    });
  }

  void _scrollToBottom({bool animated = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      if (animated) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController
            .jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Sending
  // ---------------------------------------------------------------------------

  Future<void> _send() async {
    final content = _inputController.text.trim();
    if (content.isEmpty || _isSending) return;

    setState(() => _isSending = true);
    _inputController.clear();

    final state = context.read<SyncordAppState>();

    if (widget.chatType == ChatType.dm) {
      // sendDMMessage returns the raw saved message on success, null on failure
      final savedMsg = await state.sendDMMessage(
          widget.friendId!, content, state.username);

      setState(() => _isSending = false);

      if (savedMsg == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Failed to send message'),
            backgroundColor: Colors.red,
          ));
        }
        return;
      }

      // CRITICAL: emit send-dm so the recipient's open DM page updates in
      // real-time. The REST endpoint does NOT broadcast — only the socket
      // send-dm event does. This matches how the web frontend works.
      widget.socket.sendDM(widget.friendId!, savedMsg);
    } else {
      final ok = await state.sendChannelMessage(
          widget.serverId!, widget.channelId!, content, state.username);

      setState(() => _isSending = false);

      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Failed to send message'),
          backgroundColor: Colors.red,
        ));
        return;
      }
    }

    _scrollToBottom();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF313338),
      appBar: AppBar(
        backgroundColor: const Color(0xFF313338),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Text(
              widget.chatType == ChatType.dm ? '@' : '#',
              style: const TextStyle(color: Color(0xFF949BA4), fontSize: 20),
            ),
            const SizedBox(width: 6),
            Text(
              widget.title,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 16),
            ),
          ],
        ),
        elevation: 0,
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: Color(0xFF1E1F22)),
        ),
      ),
      body: Column(
        children: [
          Expanded(child: _buildMessageList()),
          _buildComposer(),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Message list
  // ---------------------------------------------------------------------------

  Widget _buildMessageList() {
    return Consumer<SyncordAppState>(
      builder: (context, state, _) {
        final messages = state.messagesFor(widget.cacheKey);
        final loading = state.isMessagesLoading(widget.cacheKey);
        final allLoaded = state.allMessagesLoaded(widget.cacheKey);
        final currentUserId = state.userId;

        if (loading && messages.isEmpty) {
          return const Center(
              child: CircularProgressIndicator(color: Color(0xFF5865F2)));
        }

        if (messages.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  widget.chatType == ChatType.dm
                      ? Icons.chat_bubble_outline
                      : Icons.tag,
                  color: const Color(0xFF949BA4),
                  size: 48,
                ),
                const SizedBox(height: 12),
                Text(
                  widget.chatType == ChatType.dm
                      ? 'Start a conversation with ${widget.title}!'
                      : 'This is the beginning of #${widget.title}',
                  style: const TextStyle(
                      color: Color(0xFF949BA4), fontSize: 14),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        final groups = groupMessages(messages);

        return ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.only(top: 8, bottom: 8),
          itemCount: groups.length + 1, // +1 for header
          itemBuilder: (context, index) {
            // Topmost item: load-more indicator or beginning-of-chat notice
            if (index == 0) {
              return allLoaded
                  ? _buildBeginningBanner()
                  : _buildLoadMoreButton(loading);
            }
            final group = groups[index - 1];
            return _MessageGroupWrapper(
              group: group,
              isOwn: group.senderId == currentUserId,
              onInviteJoin: _handleInviteJoin,
            );
          },
        );
      },
    );
  }

  Widget _buildBeginningBanner() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 32,
            backgroundColor: const Color(0xFF5865F2),
            child: Text(
              widget.title[0].toUpperCase(),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            widget.chatType == ChatType.dm
                ? '@${widget.title}'
                : '#${widget.title}',
            style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            widget.chatType == ChatType.dm
                ? 'This is the beginning of your direct message history with @${widget.title}.'
                : 'This is the beginning of the #${widget.title} channel.',
            style: const TextStyle(color: Color(0xFF949BA4), fontSize: 13),
          ),
          const SizedBox(height: 8),
          const Divider(color: Color(0xFF3F4147)),
        ],
      ),
    );
  }

  Widget _buildLoadMoreButton(bool loading) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: _loadingMore || loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Color(0xFF5865F2)),
              )
            : TextButton(
                onPressed: _loadMore,
                child: const Text('Load older messages',
                    style: TextStyle(color: Color(0xFF5865F2))),
              ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Invite handling
  // ---------------------------------------------------------------------------

  Future<void> _handleInviteJoin(String linkCode) async {
    // Show a preview sheet before joining
    await showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF2B2D31),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => _InviteJoinSheet(linkCode: linkCode),
    );
    // After joining, refresh servers so the new one appears
    if (mounted) {
      context.read<SyncordAppState>().loadServers();
    }
  }

  // ---------------------------------------------------------------------------
  // Composer
  // ---------------------------------------------------------------------------

  Widget _buildComposer() {
    return Container(
      color: const Color(0xFF313338),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF383A40),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: TextField(
                  controller: _inputController,
                  style:
                      const TextStyle(color: Colors.white, fontSize: 15),
                  maxLines: null,
                  keyboardType: TextInputType.multiline,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: widget.chatType == ChatType.dm
                        ? 'Message @${widget.title}'
                        : 'Message #${widget.title}',
                    hintStyle:
                        const TextStyle(color: Color(0xFF6D6F78)),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    filled: false,
                  ),
                  onSubmitted: (_) => _send(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 44,
              width: 44,
              child: _isSending
                  ? const Center(
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFF5865F2)),
                      ),
                    )
                  : IconButton(
                      onPressed: _send,
                      icon: const Icon(Icons.send,
                          color: Color(0xFF5865F2)),
                      padding: EdgeInsets.zero,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message group wrapper — handles invite card rendering
// ─────────────────────────────────────────────────────────────────────────────

class _MessageGroupWrapper extends StatelessWidget {
  final MessageGroup group;
  final bool isOwn;
  final Future<void> Function(String linkCode) onInviteJoin;

  const _MessageGroupWrapper({
    required this.group,
    required this.isOwn,
    required this.onInviteJoin,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFF5865F2),
            child: Text(
              group.senderUsername.isNotEmpty
                  ? group.senderUsername[0].toUpperCase()
                  : '?',
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 15),
            ),
          ),
          const SizedBox(width: 12),
          // Content column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row
                Row(
                  children: [
                    Text(
                      group.senderUsername,
                      style: TextStyle(
                        color: isOwn
                            ? const Color(0xFF5865F2)
                            : const Color(0xFFF2F3F5),
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _formatTime(group.messages.first.createdAt),
                      style: const TextStyle(
                          color: Color(0xFF949BA4), fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                // Each message in the group
                ...group.messages.map((msg) {
                  final isInvite =
                      msg.metadata?['type'] == 'serverInvite' ||
                      msg.metadata?['type'] == 'server-invite';
                  if (isInvite) {
                    return _InviteCard(
                      message: msg,
                      onJoin: onInviteJoin,
                    );
                  }
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Flexible(
                          child: Text(
                            msg.content,
                            style: const TextStyle(
                                color: Color(0xFFDCDEE0),
                                fontSize: 15,
                                height: 1.4),
                          ),
                        ),
                        if (msg.isEdited)
                          const Padding(
                            padding: EdgeInsets.only(left: 4),
                            child: Text('(edited)',
                                style: TextStyle(
                                    color: Color(0xFF949BA4),
                                    fontSize: 11)),
                          ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final isToday = dt.year == now.year &&
        dt.month == now.month &&
        dt.day == now.day;
    final h = dt.hour;
    final m = dt.minute.toString().padLeft(2, '0');
    final period = h >= 12 ? 'PM' : 'AM';
    final hour = h > 12 ? h - 12 : (h == 0 ? 12 : h);
    if (isToday) return 'Today at $hour:$m $period';
    return '${dt.month}/${dt.day}/${dt.year}';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invite card
// ─────────────────────────────────────────────────────────────────────────────

class _InviteCard extends StatelessWidget {
  final ChatMessage message;
  final Future<void> Function(String linkCode) onJoin;

  const _InviteCard({required this.message, required this.onJoin});

  @override
  Widget build(BuildContext context) {
    final meta = message.metadata!;
    final serverName = meta['serverName']?.toString() ?? 'Unknown Server';
    final linkCode = meta['linkCode']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF2B2D31),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF1E1F22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'SERVER INVITE',
            style: TextStyle(
                color: Color(0xFF949BA4),
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF5865F2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    serverName[0].toUpperCase(),
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 18),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  serverName,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 15),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed:
                  linkCode.isEmpty ? null : () => onJoin(linkCode),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF23A559),
                padding: const EdgeInsets.symmetric(vertical: 8),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(4)),
              ),
              child: const Text('Join Server',
                  style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invite join bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _InviteJoinSheet extends StatefulWidget {
  final String linkCode;
  const _InviteJoinSheet({required this.linkCode});

  @override
  State<_InviteJoinSheet> createState() => _InviteJoinSheetState();
}

class _InviteJoinSheetState extends State<_InviteJoinSheet> {
  bool _loading = true;
  bool _joining = false;
  String? _error;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _fetchMetadata();
  }

  Future<void> _fetchMetadata() async {
    final result =
        await ApiService.getInviteMetadata(widget.linkCode);
    if (!mounted) return;
    final errMsg = result['error']?.toString() ?? '';
    if (errMsg.isNotEmpty) {
      setState(() {
        _error = errMsg;
        _loading = false;
      });
    } else {
      setState(() {
        _data = result;
        _loading = false;
      });
    }
  }

  Future<void> _join() async {
    setState(() => _joining = true);
    final result = await ApiService.joinViaInvite(widget.linkCode);
    if (!mounted) return;
    // Backend always includes "error": "" on success — only treat non-empty as error
    final errMsg = result['error']?.toString() ?? '';
    if (errMsg.isNotEmpty) {
      setState(() {
        _error = errMsg;
        _joining = false;
      });
    } else {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Joined ${result['serverName'] ?? _data?['serverName'] ?? 'server'}!'),
        backgroundColor: const Color(0xFF23A559),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(24),
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF5865F2)))
            : _error != null
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          color: Color(0xFFED4245), size: 40),
                      const SizedBox(height: 12),
                      Text(_error!,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 15),
                          textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Close'),
                      ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Drag handle
                      Container(
                        width: 40,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4E5058),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const Text(
                        'You\'ve been invited to join',
                        style: TextStyle(
                            color: Color(0xFF949BA4), fontSize: 13),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: const Color(0xFF5865F2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Center(
                          child: Text(
                            (_data?['serverName'] ?? '?')[0]
                                .toUpperCase(),
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 32),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _data?['serverName'] ?? 'Unknown Server',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w700),
                      ),
                      if (_data?['memberCount'] != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          '${_data!['memberCount']} members',
                          style: const TextStyle(
                              color: Color(0xFF949BA4), fontSize: 13),
                        ),
                      ],
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _joining
                                  ? null
                                  : () => Navigator.pop(context),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(
                                    color: Color(0xFF4E5058)),
                                foregroundColor:
                                    const Color(0xFFDCDEE0),
                                padding: const EdgeInsets.symmetric(
                                    vertical: 12),
                              ),
                              child: const Text('Cancel'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _joining ? null : _join,
                              style: ElevatedButton.styleFrom(
                                backgroundColor:
                                    const Color(0xFF23A559),
                                padding: const EdgeInsets.symmetric(
                                    vertical: 12),
                              ),
                              child: _joining
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white),
                                    )
                                  : const Text('Accept Invite',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w600)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
      ),
    );
  }
}
