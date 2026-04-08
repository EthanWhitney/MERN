import 'package:flutter/material.dart';
import 'api_service.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _userController = TextEditingController();
  final _emailController = TextEditingController();
  final _passController = TextEditingController();

  void _doRegister() async {
    // You'll need to add a 'register' method to your ApiService later!
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Registration logic coming soon...")),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF111827),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          children: [
            const Text("Create an account", 
              style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 32),
            _buildField("USERNAME", _userController),
            const SizedBox(height: 20),
            _buildField("EMAIL", _emailController),
            const SizedBox(height: 20),
            _buildField("PASSWORD", _passController, isPass: true),
            const SizedBox(height: 30),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF374151),
                minimumSize: const Size(double.infinity, 50),
                padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
              ),
              onPressed: _doRegister,
              child: const Text("Continue", style: TextStyle(color: Colors.white)),
            ),

            const SizedBox(height: 16), // Space between the buttons

            TextButton(
             onPressed: () {
               // 🔙 This "pops" the current screen off and goes back to Login
                Navigator.pop(context); 
              },
              child: const Text(
                "Already have an account? Log In",
                style: TextStyle(
                  color: Color(0xFF5865F2), // Syncord Blurple
                  fontSize: 14,
               ),
             ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, {bool isPass = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFFE5E7EB), fontSize: 12)),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          obscureText: isPass,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            fillColor: const Color(0xFF1F2937),
            filled: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(4)),
          ),
        ),
      ],
    );
  }
}