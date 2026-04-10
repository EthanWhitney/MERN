import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final http.Client _client = http.Client(); /// Create client

  /// Automatically determines the backend URL based on the platform.
  static String get baseUrl {
    if (kIsWeb) {
      return "http://localhost:5000";
    } else if (Platform.isAndroid) {
      // 10.0.2.2 is the standard alias for your PC's localhost in Android Emulators.
      // Note: If you run 'adb reverse tcp:5000 tcp:5000', 
      // you can also just use http://localhost:5000 here.
      return "http://10.0.2.2:5000"; 
    } else {
      // Default for iOS simulators or Desktop builds
      return "http://localhost:5000";
    }
  }

  static String buildPath(String path) {
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return '$baseUrl/$cleanPath';
  }

  /// Handles user login
  static Future<Map<String, dynamic>> login(String login, String password) async {
    try {
      final url = Uri.parse(buildPath('api/auth/login'));
      final response = await _client.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'emailOrUsername': login,
          'password': password,
        }),
      ).timeout(const Duration(seconds: 10));

      // Safety Check: If not JSON, don't try to decode
      if (response.headers['content-type']?.contains('text/html') ?? false) {
        return {'error': 'Server returned HTML. Check your backend URL.'};
      }

      final Map<String, dynamic> userData = jsonDecode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final SharedPreferences prefs = await SharedPreferences.getInstance();
        
        // Save Token
        if (userData.containsKey('accessToken')) {
          await prefs.setString('accessToken', userData['accessToken']);
        }
        
        // Save raw userId string (This is what your server calls need)
        if (userData.containsKey('userId')) {
          await prefs.setString('userId', userData['userId'].toString());
        }
        
        // Save separate user info if needed, but DO NOT use 'userId' as the key
        await prefs.setString('username', userData['username'] ?? '');
      }

      return userData;
    } catch (e) {
      return {'error': 'Connection failed', 'details': e.toString()};
    }
  }

  /// Handles user register
  Future<Map<String, dynamic>> register(String username, String email, String password) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/register')), 
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'email': email,
          'password': password,
        }),
      );

      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }


  /// Verify Email Function
  Future<Map<String, dynamic>> verifyEmail(String userId, String code) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/verify-email')), 
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId, 
          'verificationCode': code,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Connection failed'};
    }
  }

  /// Resend Email Verification
  static Future<Map<String, dynamic>> resendVerificationCode(String userId) async {
    try {
      final response = await _client.post(
        Uri.parse(buildPath('api/auth/resend-code')), 
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId, 
        }),
      );

      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'CONNECTION_FAILED_MESSAGE'};
    }
  }


 static Future<List<dynamic>> getServers() async {
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  
  final String? token = prefs.getString('accessToken');
  final String? userId = prefs.getString('userId'); 

  if (token == null || userId == null) {
    throw Exception("Auth data missing. Please log in again.");
  }

  try {
    final String path = 'api/users/servers'; 
    
    final response = await http.get(
      Uri.parse(buildPath(path)),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        //'userId': userId,
      },
    );

    // Debugging logs to help you see if it still fails
    debugPrint("Requesting: ${buildPath(path)}");
    debugPrint("Status Code: ${response.statusCode}");

    if (response.statusCode == 200) {
      final Map<String, dynamic> data = json.decode(response.body);
      return data['servers'] ?? [];
    } else {
      final Map<String, dynamic> errorData = json.decode(response.body);
      throw Exception(errorData['error'] ?? 'Failed to load servers');
    }
  } catch (e) {
    debugPrint("ApiService Error in getServers: $e");
    rethrow;
  }
}


  /// Helper function to verify the connection to server.js "ping" route.
  static Future<void> testPing() async {
    try {
      final response = await _client.get(Uri.parse(buildPath('api/ping')));
      debugPrint("Ping Response: ${response.body}");
    } catch (e) {
      debugPrint("Ping failed. Check your adb reverse bridge or server status: $e");
    }
  }






  static Future<Map<String, dynamic>> createServer(String name) async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String token = prefs.getString('accessToken') ?? '';
      final String userId = prefs.getString('userId') ?? '';

      final response = await _client.post(
        Uri.parse(buildPath('api/servers')), 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'serverName': name, 'ownerId': userId}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200 && response.statusCode != 201) {
        debugPrint("SERVER ERROR (${response.statusCode}): ${response.body}");
      }

      return jsonDecode(response.body);
    } catch (e) {
      debugPrint("!!! API PATH: ${buildPath('api/servers')}");
      debugPrint("!!! DETAILED ERROR: $e");
      return {'error': 'Failed to reach server'};
    }
  }

  static Future<Map<String, dynamic>> addFriend(String friendId) async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String token = prefs.getString('accessToken') ?? '';

      final response = await _client.post(
        Uri.parse(buildPath('api/users/friends/$friendId')), 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 10));
      return jsonDecode(response.body);
    } catch (e) {
      return {'error': 'Failed to reach server'};
    }
  }
}