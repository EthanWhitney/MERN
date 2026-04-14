import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:mobile/api_service.dart';

typedef MessageCallback = void Function(Map<String, dynamic> data);
typedef SimpleCallback = void Function(Map<String, dynamic> data);

class SocketService {
  IO.Socket? _socket;
  bool _connected = false;

  final Set<MessageCallback> _messageCallbacks = {};

  // Track active room subscriptions so they can be re-joined after reconnect
  String? _activeDMRecipientId;
  String? _activeServerId;
  String? _activeChannelId;
  // All DM rooms to maintain (joined passively for background message delivery)
  final Set<String> _passiveDMRooms = {};

  bool get isConnected => _connected;

  // Called once the socket successfully connects (or reconnects)
  VoidCallback? onConnected;

  void connect(
    String userId, {
    SimpleCallback? onFriendRequest,
    SimpleCallback? onFriendAccepted,
    SimpleCallback? onFriendDeclined,
    SimpleCallback? onUserOnline,
    SimpleCallback? onUserOffline,
    VoidCallback? onConnected,
  }) {
    this.onConnected = onConnected;
    if (_socket != null && _connected) return;

    _socket = IO.io(
      ApiService.baseUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .setAuth({'userId': userId})
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(1000)
          .build(),
    );

    _socket!.connect();

    _socket!.onConnect((_) {
      _connected = true;
      debugPrint('[Socket] Connected');
      // Re-join any active rooms after connect / reconnect
      _rejoinActiveRooms();
      // Notify caller so they can re-join rooms that weren't yet known
      // when connect() was first called (e.g. friends loaded after connect)
      onConnected?.call();
    });

    _socket!.on('receive-message', (data) {
      final msg = _toMap(data);
      if (msg == null) return;
      debugPrint('[Socket] receive-message: ${msg['_id']} meta=${msg['metadata']}');
      for (final cb in List.of(_messageCallbacks)) {
        try { cb(msg); } catch (_) {}
      }
    });

    if (onFriendRequest != null) {
      _socket!.on('friend-request-received', (data) {
        final m = _toMap(data); if (m != null) onFriendRequest(m);
      });
    }
    if (onFriendAccepted != null) {
      _socket!.on('friend-request-accepted', (data) {
        final m = _toMap(data); if (m != null) onFriendAccepted(m);
      });
    }
    if (onFriendDeclined != null) {
      _socket!.on('friend-request-declined', (data) {
        final m = _toMap(data); if (m != null) onFriendDeclined(m);
      });
    }
    if (onUserOnline != null) {
      _socket!.on('user-online', (data) {
        final m = _toMap(data); if (m != null) onUserOnline(m);
      });
    }
    if (onUserOffline != null) {
      _socket!.on('user-offline', (data) {
        final m = _toMap(data); if (m != null) onUserOffline(m);
      });
    }

    _socket!.onDisconnect((_) {
      _connected = false;
      debugPrint('[Socket] Disconnected');
    });
    _socket!.onConnectError((e) {
      _connected = false;
      debugPrint('[Socket] Connect error: $e');
    });
    _socket!.on('reconnect', (_) {
      debugPrint('[Socket] Reconnected');
      _rejoinActiveRooms();
    });
  }

  // ---------------------------------------------------------------------------
  // Room management
  // ---------------------------------------------------------------------------

  /// Join a DM room. Remembers the room so it is re-joined on reconnect.
  void joinDM(String recipientId) {
    _activeDMRecipientId = recipientId;
    _activeServerId = null;
    _activeChannelId = null;
    _emitIfConnected('join-dm', recipientId);
    debugPrint('[Socket] joinDM -> $recipientId (connected: $_connected)');
  }

  void leaveCurrentDM() {
    _activeDMRecipientId = null;
  }

  /// Join a DM room without marking it as the "active" room.
  /// Used to subscribe to all friend rooms on startup so messages arrive
  /// even when no ChatPage is open (e.g. incoming invite cards).
  void joinDMPassive(String recipientId) {
    _passiveDMRooms.add(recipientId);
    _emitIfConnected('join-dm', recipientId);
  }

  /// Join a server text channel room. Remembers it for reconnect.
  void joinServerChannel(String serverId, String channelId) {
    _activeServerId = serverId;
    _activeChannelId = channelId;
    _activeDMRecipientId = null;
    _emitIfConnected(
        'join-server-channel', {'serverId': serverId, 'channelId': channelId});
    debugPrint('[Socket] joinServerChannel -> $serverId/$channelId (connected: $_connected)');
  }

  void leaveServerChannel(String serverId, String channelId) {
    if (_activeServerId == serverId && _activeChannelId == channelId) {
      _activeServerId = null;
      _activeChannelId = null;
    }
    _emitIfConnected(
        'leave-server-channel', {'serverId': serverId, 'channelId': channelId});
  }

  /// Re-emit join for whatever room was active before a disconnect.
  void _rejoinActiveRooms() {
    // Rejoin all passive DM rooms (for background message delivery)
    for (final id in _passiveDMRooms) {
      debugPrint('[Socket] Rejoining passive DM: $id');
      _socket?.emit('join-dm', id);
    }
    // Rejoin the active room (open ChatPage)
    if (_activeDMRecipientId != null) {
      debugPrint('[Socket] Rejoining active DM: $_activeDMRecipientId');
      _socket?.emit('join-dm', _activeDMRecipientId);
    } else if (_activeServerId != null && _activeChannelId != null) {
      debugPrint('[Socket] Rejoining channel: $_activeServerId/$_activeChannelId');
      _socket?.emit('join-server-channel',
          {'serverId': _activeServerId, 'channelId': _activeChannelId});
    }
  }

  // ---------------------------------------------------------------------------
  // Sending
  // ---------------------------------------------------------------------------

  void sendDM(String recipientId, Map<String, dynamic> message) {
    _emitIfConnected('send-dm', {'recipientId': recipientId, 'message': message});
  }

  // ---------------------------------------------------------------------------
  // Message callbacks
  // ---------------------------------------------------------------------------

  void addMessageListener(MessageCallback cb) => _messageCallbacks.add(cb);
  void removeMessageListener(MessageCallback cb) => _messageCallbacks.remove(cb);

  // ---------------------------------------------------------------------------
  // Voice channel events
  // ---------------------------------------------------------------------------

  void joinVoice(String channelId, String userId, String username) {
    _emitIfConnected('join-voice', {
      'channelId': channelId,
      'userId': userId,
      'username': username,
    });
  }

  void leaveVoice(String channelId, String userId) {
    _emitIfConnected('leave-voice', {'channelId': channelId, 'userId': userId});
  }

  void emitVoice(String event, Map<String, dynamic> data) {
    _emitIfConnected(event, data);
  }

  final Map<String, dynamic Function(dynamic)> _voiceListeners = {};

  void onVoiceEvent(String event, void Function(dynamic) handler) {
    dynamic wrapper(dynamic data) { handler(data); return null; }
    _voiceListeners[event] = wrapper;
    _socket?.on(event, wrapper);
  }

  void offVoiceEvent(String event) {
    final handler = _voiceListeners.remove(event);
    if (handler != null) _socket?.off(event, handler);
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    _connected = false;
    _activeDMRecipientId = null;
    _activeServerId = null;
    _activeChannelId = null;
    _passiveDMRooms.clear();
    _messageCallbacks.clear();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Emit immediately if connected; the room will be re-joined on next
  /// connect via _rejoinActiveRooms if we're currently disconnected.
  void _emitIfConnected(String event, dynamic data) {
    if (_connected && _socket != null) {
      _socket!.emit(event, data);
    } else {
      debugPrint('[Socket] _emitIfConnected: not connected, dropping $event');
    }
  }

  Map<String, dynamic>? _toMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return null;
  }
}
