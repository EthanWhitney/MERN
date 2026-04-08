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
  final _codeController = TextEditingController();
  String? _pendingUserId;

  void _doRegister() async {
    final username = _userController.text.trim();
    final email = _emailController.text.trim();
    final password = _passController.text.trim();

    // Simple validation
    if (username.isEmpty || email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Please fill in all fields")),
      );
      return;
    }

    final apiService = ApiService();
    final result = await apiService.register(username, email, password);

    if (!mounted) return;

    if (result['error'] != null && result['error'].isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['error'])),
      );
    } else {
      setState(() {
        _pendingUserId = result['userId'];
      });

      _showVerificationPopup();
    }
  }

  void _showVerificationPopup() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF2C2F33), // Syncord Dark
        title: const Text("Verify Email", style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "Enter the 6-digit code sent to your email.",
              style: TextStyle(color: Colors.white70),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _codeController, 
              keyboardType: TextInputType.number,
              maxLength: 6,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                hintText: "123456",
                hintStyle: TextStyle(color: Colors.white24),
                enabledBorder: UnderlineInputBorder(
                  borderSide: BorderSide(color: Colors.white54),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel", style: TextStyle(color: Colors.redAccent)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF5865F2)),
            onPressed: () => _verifyCode(_codeController.text),
            child: const Text("Verify", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _verifyCode(String code) async {
    if (_pendingUserId == null) return;

    final apiService = ApiService();
    final result = await apiService.verifyEmail(_pendingUserId!, code);

    if (!mounted) return;

    if (result['success'] == true) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Email verified! You can now log in.")),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['error'] ?? "Verification failed")),
      );
    }
  }


  @override
  void dispose() {
    _userController.dispose();
    _emailController.dispose();
    _passController.dispose();
    _codeController.dispose();
    super.dispose();
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
            _buildField("EMAIL", _emailController, kType: TextInputType.emailAddress),
            const SizedBox(height: 20),
            _buildField("PASSWORD", _passController, isPass: true, kType: TextInputType.visiblePassword),
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
                Navigator.pop(context); 
              },
              child: const Text(
                "Already have an account? Log In",
                style: TextStyle(
                  color: Color(0xFF5865F2),
                  fontSize: 14,
               ),
             ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, {bool isPass = false, TextInputType? kType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFFE5E7EB), fontSize: 12)),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          obscureText: isPass,
          keyboardType: kType ?? TextInputType.text,
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