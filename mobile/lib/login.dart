import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:mobile/api_service.dart'; 
import 'register_page.dart';
import 'home_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  // Controllers to grab the text from fields
  final TextEditingController _loginController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  Future<void> doLogin() async {
    try {
      final res = await ApiService.login(
        _loginController.text,
        _passwordController.text,
      );

      // 1. Handle Errors from API
      if (res['error'] != null && res['error'].toString().isNotEmpty) {
        _showError(res['error']);
        return;
      }

      // 2. Extract data returned from the API service
      String userId = res['userId']?.toString() ?? '';
      String username = res['username'] ?? '';

      if (userId.isEmpty) {
        _showError('Login failed: Invalid User Data');
        return;
      }

      // 3. Navigate - Data is already saved by ApiService.login
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => HomePage(
            username: username,
            userId: userId,
          ),
        ),
      );
    } catch (e) {
      _showError("An unexpected error occurred.");
    }
  }

  // Helper to show the SnackBar
  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  @override
  void dispose() {
    // Clean up the controllers when the widget is removed from the tree
    _loginController.dispose();
    _passwordController.dispose();
    super.dispose();
  }



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF111827), 
      body: Center(
        child: SingleChildScrollView( // Prevents errors when the keyboard pops up
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Branding / Logo area
                //Image.asset('assets/syncord_logo.png', height: 80), // If an asset, it needs an actual file, duh
                //const Icon(Icons.groups_rounded, size: 80, color: Color(0xFF5865F2)),
                const Icon(Icons.forum_rounded, size: 80, color: Color(0xFF5865F2)),
                const SizedBox(height: 16),
                const Text(
                  "Welcome back!",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  "We're so excited to see you again!",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFFB5BAC1), fontSize: 14),
                ),
                const SizedBox(height: 32),

                // Input Fields
                _buildTextField(
                  label: "EMAIL OR USERNAME",
                  controller: _loginController,
                ),
                const SizedBox(height: 20),
                _buildTextField(
                  label: "PASSWORD",
                  controller: _passwordController,
                  isPassword: true,
                ),
                
                const SizedBox(height: 24),

                // The Login Button
                ElevatedButton(
                  onPressed: doLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF374151),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    "Log In",
                    style: TextStyle(color: Colors.white, fontSize: 16),
                  ),
                ),

                TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RegisterPage()),
                  );
                  },
                child: const Text("Need an account? Register", 
                  style: TextStyle(color: Color(0xFF5865F2))),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // A helper widget to keep the code clean and consistent
  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    bool isPassword = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFFB5BAC1),
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: isPassword,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            filled: true,
            // fillColor: const Color(0xFF1E1F22), // Input background
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        ),
      ],
    );
  }
}