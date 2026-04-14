import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final http.Client _client = http.Client();

  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:5000';
    if (Platform.isAndroid) return 'http://10.0.2.2:5000';
    return 'http://localhost:5000';
  }

  static String buildPath(String path) {
    final clean = path.startsWith('/') ? path.substring(1) : path;
    return '$baseUrl/$clean';
  }

  static Future<Map<String, String>> _authHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('accessToken') ?? '';
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  // Auth -----------------------------------------------------------------------

  static Future<Map<String, dynamic>> login(String login, String password) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/login')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'emailOrUsername': login, 'password': password}),
      ).timeout(const Duration(seconds: 10));

      if (response.headers['content-type']?.contains('text/html') ?? false) {
        return {'error': 'Server returned HTML. Check your backend URL.'};
      }
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode == 200 || response.statusCode == 201) {
        final prefs = await SharedPreferences.getInstance();
        if (data['accessToken'] != null) await prefs.setString('accessToken', data['accessToken']);
        if (data['userId'] != null) await prefs.setString('userId', data['userId'].toString());
        await prefs.setString('username', data['username'] ?? '');
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed', 'details': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> register(String username, String email, String password) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/register')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'email': email, 'password': password}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> verifyEmail(String userId, String code) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/verify-email')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': userId, 'verificationCode': code}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> resendVerificationCode(String userId) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/resend-code')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': userId}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }


  static Future<Map<String, dynamic>> requestPasswordReset(String email) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/request-password-reset')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> verifyResetCode({
    required String email,
    required String code,
  }) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/verify-reset-code')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'code': code}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/reset-password')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'code': code,
          'newPassword': newPassword,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }
  

  // Servers --------------------------------------------------------------------

  static Future<List<dynamic>> getServers() async {
    final headers = await _authHeaders();
    try {
      final response = await _client.get(Uri.parse(buildPath('api/users/servers')), headers: headers);
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as Map)['servers'] ?? [];
      }
      throw Exception('Failed to load servers (${response.statusCode})');
    } catch (e) {
      debugPrint('getServers error: $e');
      rethrow;
    }
  }

  /// ownerId now comes from the JWT token on the backend — do NOT send it in body.
  static Future<Map<String, dynamic>> createServer(String name) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/servers')),
        headers: headers,
        body: jsonEncode({'serverName': name}),
      ).timeout(const Duration(seconds: 10));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200 && response.statusCode != 201) {
        return {'error': data['error'] ?? 'Failed to create server (${response.statusCode})'};
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed: $e'};
    }
  }

  // Voice Channels -------------------------------------------------------------

  static Future<List<dynamic>> getVoiceChannels(String serverId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.get(
        Uri.parse(buildPath('api/servers/$serverId/voiceChannels')),
        headers: headers,
      );
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as Map)['channels'] ?? [];
      }
      return [];
    } catch (e) {
      debugPrint('getVoiceChannels error: $e');
      return [];
    }
  }

  static Future<Map<String, dynamic>> createVoiceChannel(
      String serverId, String channelName) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/servers/$serverId/voiceChannels')),
        headers: headers,
        body: jsonEncode({'channelName': channelName}),
      ).timeout(const Duration(seconds: 10));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200 && response.statusCode != 201) {
        return {'error': data['error'] ?? 'Failed to create voice channel'};
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  // Text Channels --------------------------------------------------------------

  /// Full channel objects (name + id). The server list only returns IDs.
  static Future<List<dynamic>> getTextChannels(String serverId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.get(
        Uri.parse(buildPath('api/servers/$serverId/textChannels')),
        headers: headers,
      );
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as Map)['textChannels'] ?? [];
      }
      throw Exception('Failed to load channels (${response.statusCode})');
    } catch (e) {
      debugPrint('getTextChannels error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> createTextChannel(String serverId, String channelName) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/servers/$serverId/textChannels')),
        headers: headers,
        body: jsonEncode({'channelName': channelName}),
      ).timeout(const Duration(seconds: 10));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200 && response.statusCode != 201) {
        return {'error': data['error'] ?? 'Failed to create channel'};
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed: $e'};
    }
  }

  // Friends --------------------------------------------------------------------

  static Future<List<dynamic>> getFriends() async {
    final headers = await _authHeaders();
    try {
      final response = await _client.get(Uri.parse(buildPath('api/users/friends')), headers: headers);
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as Map)['friends'] ?? [];
      }
      throw Exception('Failed to load friends');
    } catch (e) {
      debugPrint('getFriends error: $e');
      rethrow;
    }
  }

  static Future<List<dynamic>> getPendingRequests() async {
    final headers = await _authHeaders();
    try {
      final response = await _client.get(Uri.parse(buildPath('api/users/friends/pending')), headers: headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map;
        return data['pendingRequests'] ?? data['requests'] ?? [];
      }
      throw Exception('Failed to load pending requests');
    } catch (e) {
      debugPrint('getPendingRequests error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> addFriendByUsername(String username) async {
    final headers = await _authHeaders();
    try {
      final searchRes = await _client.get(
        Uri.parse(buildPath('api/users/search?username=${Uri.encodeComponent(username)}')),
        headers: headers,
      );
      if (searchRes.statusCode != 200) return {'error': 'User not found'};
      final searchData = jsonDecode(searchRes.body);
      final friendId = searchData['user']?['_id'] ?? searchData['_id'] ?? searchData['userId'];
      if (friendId == null) return {'error': 'User not found'};
      final res = await _client.post(Uri.parse(buildPath('api/users/friends/$friendId')), headers: headers);
      return jsonDecode(res.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> acceptFriendRequest(String friendId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(Uri.parse(buildPath('api/users/friends/$friendId/accept')), headers: headers);
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> declineFriendRequest(String friendId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.delete(Uri.parse(buildPath('api/users/friends/$friendId')), headers: headers);
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  // Invites --------------------------------------------------------------------

  static Future<Map<String, dynamic>> getInviteMetadata(String linkCode) async {
    try {
      final response = await _client.get(Uri.parse(buildPath('api/invites/$linkCode')));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200) return {'error': data['error'] ?? 'Invalid invite'};
      return data;
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> joinViaInvite(String linkCode) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(Uri.parse(buildPath('api/invites/$linkCode/join')), headers: headers);
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200 && response.statusCode != 201) {
        return {'error': data['error'] ?? 'Failed to join server'};
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  static Future<Map<String, dynamic>> createInvite(String serverId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/servers/$serverId/invites')),
        headers: headers,
        body: jsonEncode({}),
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200 && response.statusCode != 201) {
        return {'error': data['error'] ?? 'Failed to create invite'};
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  // Direct Messages ------------------------------------------------------------

  static Future<List<dynamic>> getDMMessages(String recipientId, {String? before, int limit = 50}) async {
    final headers = await _authHeaders();
    try {
      var url = 'api/chat/dms/$recipientId/messages?limit=$limit';
      if (before != null) url += '&before=$before';
      final response = await _client.get(Uri.parse(buildPath(url)), headers: headers);
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as Map)['messages'] ?? [];
      }
      throw Exception('Failed to load messages (${response.statusCode})');
    } catch (e) {
      debugPrint('getDMMessages error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> sendDMMessage(
      String recipientId, String content,
      {Map<String, dynamic>? metadata}) async {
    final headers = await _authHeaders();
    try {
      final body = <String, dynamic>{'content': content};
      if (metadata != null) body['metadata'] = metadata;
      final response = await _client.post(
        Uri.parse(buildPath('api/chat/dms/$recipientId/messages')),
        headers: headers,
        body: jsonEncode(body),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Failed to send message'};
    }
  }

  /// Send a server invite card as a DM using the metadata field.
  static Future<Map<String, dynamic>> sendInviteAsDM(
      String recipientId, String serverId, String serverName, String linkCode) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/chat/dms/$recipientId/messages')),
        headers: headers,
        body: jsonEncode({
          'content': 'You\'ve been invited to join **$serverName**!',
          'metadata': {
            'type': 'server-invite',
            'linkCode': linkCode,
            'serverName': serverName,
            'serverId': serverId,
          },
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Failed to send invite'};
    }
  }

  // Server Channel Messages ----------------------------------------------------

  static Future<List<dynamic>> getChannelMessages(String serverId, String channelId,
      {String? before, int limit = 50}) async {
    final headers = await _authHeaders();
    try {
      var url = 'api/servers/$serverId/textChannels/$channelId/messages?limit=$limit';
      if (before != null) url += '&before=$before';
      final response = await _client.get(Uri.parse(buildPath(url)), headers: headers);
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as Map)['messages'] ?? [];
      }
      throw Exception('Failed to load messages (${response.statusCode})');
    } catch (e) {
      debugPrint('getChannelMessages error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> sendChannelMessage(
      String serverId, String channelId, String content) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/servers/$serverId/textChannels/$channelId/messages')),
        headers: headers,
        body: jsonEncode({'content': content}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Failed to send message'};
    }
  }
  // Expose auth headers publicly for widgets that need them
  static Future<Map<String, String>> authHeadersPublic() => _authHeaders();

  // ---------------------------------------------------------------------------
  // Extended invite methods
  // ---------------------------------------------------------------------------

  /// Fetch all active invite links for a server.
  static Future<List<dynamic>> getInvites(String serverId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.get(
        Uri.parse(buildPath('api/servers/$serverId/invites')),
        headers: headers,
      );
      if (response.statusCode == 200) {
        return (jsonDecode(response.body) as Map)['invites'] ?? [];
      }
      throw Exception('Failed to load invites (${response.statusCode})');
    } catch (e) {
      debugPrint('getInvites error: \$e');
      rethrow;
    }
  }

  /// Create a personal (targeted) invite for a specific user.
  static Future<Map<String, dynamic>> createPersonalInvite(
      String serverId, String recipientUserId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/servers/$serverId/personal-invites')),
        headers: headers,
        body: jsonEncode({'recipientUserId': recipientUserId}),
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200 && response.statusCode != 201) {
        return {'error': data['error'] ?? 'Failed to create personal invite'};
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  /// Revoke an invite link.
  static Future<Map<String, dynamic>> revokeInvite(
      String serverId, String linkCode) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.delete(
        Uri.parse(buildPath('api/servers/$serverId/invites/$linkCode')),
        headers: headers,
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200) {
        return {'error': data['error'] ?? 'Failed to revoke invite'};
      }
      return data;
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  /// Send a personal server invite as a DM (matches frontend metadata format).
  static Future<Map<String, dynamic>> sendPersonalInviteDM({
    required String friendId,
    required String serverName,
    required String serverId,
    required String linkCode,
    required String username,
  }) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/chat/dms/$friendId/messages')),
        headers: headers,
        body: jsonEncode({
          // Use 'message' key to match what the frontend sends
          'message': '$username, you\'ve been invited to join $serverName!',
          'metadata': {
            'type': 'serverInvite',
            'serverName': serverName,
            'linkCode': linkCode,
            'serverId': serverId,
          },
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  /// Get the list of member IDs for a server (to check who is already a member).
  static Future<List<dynamic>> getServerMemberIds(String serverId) async {
    final headers = await _authHeaders();
    try {
      final response = await _client.get(
        Uri.parse(buildPath('api/servers/$serverId/members')),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map;
        return data['members'] ?? [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }
}