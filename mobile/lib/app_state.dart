import 'package:flutter/material.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/models/server_model.dart';
import 'package:mobile/models/friend_model.dart';
import 'package:mobile/models/chat_message.dart';

export 'package:mobile/models/server_model.dart';
export 'package:mobile/models/friend_model.dart';
export 'package:mobile/models/chat_message.dart';

enum ViewMode { server, dm }

class SyncordAppState extends ChangeNotifier {
  // Auth -----------------------------------------------------------------------
  String _userId = '';
  String _username = '';
  String get userId => _userId;
  String get username => _username;

  void setUserInfo(String userId, String username) {
    _userId = userId;
    _username = username;
    notifyListeners();
  }

  // View mode ------------------------------------------------------------------
  ViewMode _currentMode = ViewMode.dm;
  ViewMode get currentMode => _currentMode;

  void setViewMode(ViewMode mode) {
    _currentMode = mode;
    if (mode == ViewMode.dm) _selectedServer = null;
    notifyListeners();
  }

  // Servers --------------------------------------------------------------------
  List<ServerModel> _servers = [];
  ServerModel? _selectedServer;
  TextChannel? _selectedChannel;
  bool _serversLoading = false;
  final Map<String, List<TextChannel>> _channelCache = {};
  final Map<String, List<VoiceChannel>> _voiceChannelCache = {};

  List<ServerModel> get servers => _servers;
  ServerModel? get selectedServer => _selectedServer;
  TextChannel? get selectedChannel => _selectedChannel;
  bool get serversLoading => _serversLoading;

  List<TextChannel> channelsFor(String serverId) =>
      _channelCache[serverId] ?? [];
  List<VoiceChannel> voiceChannelsFor(String serverId) =>
      _voiceChannelCache[serverId] ?? [];

  void selectServer(ServerModel server) {
    _selectedServer = server;
    _selectedChannel = null;
    _currentMode = ViewMode.server;
    notifyListeners();
    loadTextChannels(server.id);
    loadVoiceChannels(server.id);
  }

  void selectChannel(TextChannel channel) {
    _selectedChannel = channel;
    notifyListeners();
  }

  Future<void> loadServers() async {
    _serversLoading = true;
    notifyListeners();
    try {
      final response = await ApiService.getServers();
      _servers = response.map((s) => ServerModel.fromJson(s)).toList();
    } catch (e) {
      debugPrint('loadServers error: $e');
    } finally {
      _serversLoading = false;
      notifyListeners();
    }
  }

  Future<void> createServer(String name) async {
    final result = await ApiService.createServer(name);
    if (result['error'] != null && result['error'].toString().isNotEmpty) {
      throw result['error'];
    }
    await loadServers();
  }

  Future<void> loadTextChannels(String serverId) async {
    try {
      final data = await ApiService.getTextChannels(serverId);
      _channelCache[serverId] =
          data.map((ch) => TextChannel.fromJson(ch)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('loadTextChannels error: $e');
    }
  }

  Future<void> createTextChannel(String serverId, String name) async {
    final result = await ApiService.createTextChannel(serverId, name);
    if (result['error'] != null && result['error'].toString().isNotEmpty) {
      throw result['error'];
    }
    await loadTextChannels(serverId);
  }

  Future<void> loadVoiceChannels(String serverId) async {
    try {
      final data = await ApiService.getVoiceChannels(serverId);
      _voiceChannelCache[serverId] =
          data.map((ch) => VoiceChannel.fromJson(ch)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('loadVoiceChannels error: $e');
    }
  }

  Future<void> createVoiceChannel(String serverId, String name) async {
    final result = await ApiService.createVoiceChannel(serverId, name);
    if (result['error'] != null && result['error'].toString().isNotEmpty) {
      throw result['error'];
    }
    await loadVoiceChannels(serverId);
  }

  // Friends --------------------------------------------------------------------
  List<FriendModel> _friends = [];
  List<FriendModel> _pendingRequests = [];
  bool _friendsLoading = false;
  String _friendsError = '';

  List<FriendModel> get friends => _friends;
  List<FriendModel> get pendingRequests => _pendingRequests;
  bool get friendsLoading => _friendsLoading;
  String get friendsError => _friendsError;

  Future<void> loadFriends() async {
    _friendsLoading = true;
    _friendsError = '';
    notifyListeners();
    try {
      final results = await Future.wait([
        ApiService.getFriends(),
        ApiService.getPendingRequests(),
      ]);
      _friends = results[0].map((f) => FriendModel.fromJson(f)).toList();
      _pendingRequests =
          results[1].map((f) => FriendModel.fromJson(f)).toList();
    } catch (e) {
      _friendsError = 'Failed to load friends';
    } finally {
      _friendsLoading = false;
      notifyListeners();
    }
  }

  Future<void> addFriendByUsername(String username) async {
    final result = await ApiService.addFriendByUsername(username);
    if (result['error'] != null) throw result['error'];
    await loadFriends();
  }

  Future<void> acceptFriendRequest(String friendId) async {
    await ApiService.acceptFriendRequest(friendId);
    await loadFriends();
  }

  Future<void> declineFriendRequest(String friendId) async {
    await ApiService.declineFriendRequest(friendId);
    await loadFriends();
  }

  void setFriendOnline(String userId, bool online) {
    final idx = _friends.indexWhere((f) => f.id == userId);
    if (idx != -1) {
      _friends[idx] = _friends[idx].copyWith(online: online);
      notifyListeners();
    }
  }

  // Messages -------------------------------------------------------------------
  final Map<String, List<ChatMessage>> _messageCache = {};
  final Map<String, bool> _loadingMessages = {};
  final Map<String, bool> _allLoaded = {};

  List<ChatMessage> messagesFor(String key) => _messageCache[key] ?? [];
  bool isMessagesLoading(String key) => _loadingMessages[key] ?? false;
  bool allMessagesLoaded(String key) => _allLoaded[key] ?? false;

  Future<void> loadDMMessages(String friendId, {bool refresh = false}) async {
    final key = 'dm_$friendId';
    if (_loadingMessages[key] == true) return;
    _loadingMessages[key] = true;
    notifyListeners();
    try {
      final existing = _messageCache[key] ?? [];
      final before =
          (!refresh && existing.isNotEmpty) ? existing.first.id : null;
      final data = await ApiService.getDMMessages(friendId, before: before);
      final fetched = data.map((m) => ChatMessage.fromJson(m)).toList();

      if (refresh || existing.isEmpty) {
        // On refresh, keep any messages that were sent optimistically from
        // the home page (e.g. invite cards) that aren't yet in the server
        // response — identified by having a temp_ id or an id not in fetched.
        final fetchedIds = fetched.map((m) => m.id).toSet();
        final localOnly = existing.where(
          (m) => m.id.startsWith('temp_') || !fetchedIds.contains(m.id),
        ).toList();
        _messageCache[key] = [...fetched, ...localOnly];
      } else {
        _messageCache[key] = [...fetched, ...existing];
      }
      _allLoaded[key] = fetched.length < 50;
    } catch (e) {
      debugPrint('loadDMMessages error: $e');
    } finally {
      _loadingMessages[key] = false;
      notifyListeners();
    }
  }

  /// Sends a DM via REST, optimistically appends it locally, and returns the
  /// raw saved message so the caller can forward it over the socket.
  /// [metadata] is included in the optimistic message so invite cards appear
  /// immediately on the sender's screen without a refresh.
  /// Returns null on failure.
  Future<Map<String, dynamic>?> sendDMMessage(
      String friendId, String content, String senderUsername,
      {Map<String, dynamic>? metadata}) async {
    final key = 'dm_$friendId';
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';

    _appendMessage(
      key,
      ChatMessage(
        id: tempId,
        content: content,
        senderId: _userId,
        senderUsername: senderUsername,
        senderProfilePicture: '',
        createdAt: DateTime.now(),
        metadata: metadata,
      ),
    );

    try {
      final result = await ApiService.sendDMMessage(friendId, content, metadata: metadata);
      if (result['error'] != null && result['error'].toString().isNotEmpty) {
        _removeTemp(key, tempId);
        return null;
      }
      final raw = result['message'];
      if (raw is Map<String, dynamic>) {
        final real = ChatMessage.fromJson(raw);
        final current = List<ChatMessage>.from(_messageCache[key] ?? []);
        final idx = current.indexWhere((m) => m.id == tempId);
        if (idx != -1) {
          current[idx] = real;
          _messageCache[key] = current;
          notifyListeners();
        }
        return raw;
      }
      return result;
    } catch (e) {
      _removeTemp(key, tempId);
      return null;
    }
  }

  Future<void> loadChannelMessages(String serverId, String channelId,
      {bool refresh = false}) async {
    final key = 'ch_$channelId';
    if (_loadingMessages[key] == true) return;
    _loadingMessages[key] = true;
    notifyListeners();
    try {
      final existing = _messageCache[key] ?? [];
      final before =
          (!refresh && existing.isNotEmpty) ? existing.first.id : null;
      final data = await ApiService.getChannelMessages(serverId, channelId,
          before: before);
      final fetched = data.map((m) => ChatMessage.fromJson(m)).toList();
      _messageCache[key] =
          (refresh || existing.isEmpty) ? fetched : [...fetched, ...existing];
      _allLoaded[key] = fetched.length < 50;
    } catch (e) {
      debugPrint('loadChannelMessages error: $e');
    } finally {
      _loadingMessages[key] = false;
      notifyListeners();
    }
  }

  Future<bool> sendChannelMessage(String serverId, String channelId,
      String content, String senderUsername) async {
    final key = 'ch_$channelId';
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';

    _appendMessage(
      key,
      ChatMessage(
        id: tempId,
        content: content,
        senderId: _userId,
        senderUsername: senderUsername,
        senderProfilePicture: '',
        createdAt: DateTime.now(),
      ),
    );

    try {
      final result =
          await ApiService.sendChannelMessage(serverId, channelId, content);
      if (result['error'] != null && result['error'].toString().isNotEmpty) {
        _removeTemp(key, tempId);
        return false;
      }
      final raw = result['message'];
      if (raw is Map<String, dynamic>) {
        final real = ChatMessage.fromJson(raw);
        final current = List<ChatMessage>.from(_messageCache[key] ?? []);
        final idx = current.indexWhere((m) => m.id == tempId);
        if (idx != -1) {
          current[idx] = real;
          _messageCache[key] = current;
          notifyListeners();
        }
      }
      return true;
    } catch (e) {
      _removeTemp(key, tempId);
      return false;
    }
  }

  /// Called by socket when a real-time message arrives from someone else.
  void handleIncomingMessage(Map<String, dynamic> raw,
      {String? myUserId}) {
    final senderId = raw['senderId']?.toString() ??
        raw['userId']?.toString() ??
        raw['senderID']?.toString();

    debugPrint('[State] handleIncoming: senderId=$senderId myUserId=$myUserId rawKeys=${raw.keys.toList()}');

    // Drop echoes of our own messages — already shown optimistically
    if (senderId != null && senderId == myUserId) {
      debugPrint('[State] Dropping own message echo');
      return;
    }

    final msg = ChatMessage.fromJson(raw);
    final serverId =
        raw['serverId']?.toString() ?? raw['serverID']?.toString();
    final channelId =
        raw['channelId']?.toString() ?? raw['channelID']?.toString();
    final recipientId = raw['recieverId']?.toString() ??
        raw['recipientId']?.toString() ??
        raw['recipientID']?.toString();

    String? key;
    if (serverId != null && channelId != null) {
      key = 'ch_$channelId';
    } else if (senderId != null) {
      key = 'dm_$senderId';
    } else if (recipientId != null && myUserId != null) {
      key = 'dm_$recipientId';
    }

    debugPrint('[State] handleIncoming key=$key senderId=$senderId recipientId=$recipientId');
    if (key == null) return;

    debugPrint('[State] handleIncomingMessage key=$key msgId=${msg.id} metadata=${msg.metadata}');
    // Always append — even if this conversation hasn't been opened yet.
    // Previously we dropped messages for unopened conversations
    // (!_messageCache.containsKey(key)), which meant an invite DM sent while
    // the user was on the home screen was silently lost. Now we initialise
    // the cache entry on the fly so the message is waiting when they open it.
    _appendMessage(key, msg);
  }

  void _appendMessage(String key, ChatMessage msg) {
    final current = _messageCache[key] ?? [];
    if (msg.id.isNotEmpty &&
        !msg.id.startsWith('temp_') &&
        current.any((m) => m.id == msg.id)) return;
    _messageCache[key] = [...current, msg];
    notifyListeners();
  }

  void _removeTemp(String key, String tempId) {
    _messageCache[key] =
        (_messageCache[key] ?? []).where((m) => m.id != tempId).toList();
    notifyListeners();
  }

  // Reset ----------------------------------------------------------------------
  Future<void> reset() async {
    _userId = '';
    _username = '';
    _servers = [];
    _selectedServer = null;
    _selectedChannel = null;
    _channelCache.clear();
    _voiceChannelCache.clear();
    _friends = [];
    _pendingRequests = [];
    _messageCache.clear();
    _currentMode = ViewMode.dm;
    notifyListeners();
  }
}
