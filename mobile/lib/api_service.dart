import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

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

  /// Handles user login
  static Future<Map<String, dynamic>> login(String login, String password) async {
    try {
      final url = Uri.parse('$baseUrl/api/auth/login');
      
      final response = await _client.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'emailOrUsername': login,
          'password': password,
        }),
      ).timeout(const Duration(seconds: 10)); // Prevents the app from hanging forever if the bridge is down

      return jsonDecode(response.body);
    } catch (e) {
      return {
        'error': 'Connection failed',
        'details': e.toString(),
      };
    }
  }

  /// Handles user register
  Future<Map<String, dynamic>> register(String username, String email, String password) async {
    try {
      final response = await _client.post(
        Uri.parse('$baseUrl/api/auth/register'), 
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
        Uri.parse('$baseUrl/api/auth/verify-email'), 
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
        Uri.parse('$baseUrl/api/auth/resend-code'), 
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


  /// Helper function to verify the connection to server.js "ping" route.
  static Future<void> testPing() async {
    try {
      final response = await _client.get(Uri.parse('$baseUrl/api/ping'));
      debugPrint("Ping Response: ${response.body}");
    } catch (e) {
      debugPrint("Ping failed. Check your adb reverse bridge or server status: $e");
    }
  }
}