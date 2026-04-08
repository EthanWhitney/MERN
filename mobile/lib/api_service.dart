import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiService {
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

  /// Handles user login by hitting the /api/auth/login endpoint defined in server.js
  static Future<Map<String, dynamic>> login(String login, String password) async {
    try {
      // We use the /api/auth prefix to match your Express router: app.use('/api/auth', authRoutes)
      final url = Uri.parse('$baseUrl/api/auth/login');
      
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'emailOrUsername': login, // Matches your backend's expected key
          'password': password,
        }),
      ).timeout(const Duration(seconds: 10)); // Prevents the app from hanging forever if the bridge is down

      return jsonDecode(response.body);
    } catch (e) {
      // Catching errors like SocketException (no internet) or Timeout
      return {
        'error': 'Connection failed',
        'details': e.toString(),
      };
    }
  }

  /// Helper function to verify the connection to your server.js "ping" route.
  /// You can call this in your main.dart to test the bridge.
  static Future<void> testPing() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/ping'));
      debugPrint("Ping Response: ${response.body}");
    } catch (e) {
      debugPrint("Ping failed. Check your adb reverse bridge or server status: $e");
    }
  }
}