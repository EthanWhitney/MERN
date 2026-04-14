import 'package:flutter/material.dart';
import 'package:mobile/api_service.dart';
import 'package:mobile/register_page.dart';
import 'package:mobile/home_page.dart';
import 'package:mobile/forgot_password_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _loginController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _loginController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _doLogin() async {
    if (_isLoading) return;
    final login = _loginController.text.trim();
    final password = _passwordController.text;
    if (login.isEmpty || password.isEmpty) {
      _showError('Please fill in all fields.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final res = await ApiService.login(login, password);

      if (res['error'] != null && res['error'].toString().isNotEmpty) {
        _showError(res['error'].toString());
        return;
      }

      final userId = res['userId']?.toString() ?? '';
      final username = res['username'] ?? '';

      if (userId.isEmpty) {
        _showError('Login failed: Invalid user data.');
        return;
      }

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => HomePage(username: username, userId: userId),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFED4245),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF111827),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo
                const Icon(Icons.forum_rounded,
                    size: 80, color: Color(0xFF5865F2)),
                const SizedBox(height: 16),
                const Text(
                  'Welcome back!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  "We're so excited to see you again!",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFFB5BAC1), fontSize: 14),
                ),
                const SizedBox(height: 32),

                // Email or username
                _buildLabel('EMAIL OR USERNAME'),
                const SizedBox(height: 6),
                TextField(
                  controller: _loginController,
                  style: const TextStyle(color: Colors.white),
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(),
                ),
                const SizedBox(height: 20),

                // Password
                _buildLabel('PASSWORD'),
                const SizedBox(height: 6),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: const TextStyle(color: Colors.white),
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _doLogin(),
                  decoration: InputDecoration(
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility,
                        color: const Color(0xFF949BA4),
                        size: 20,
                      ),
                      onPressed: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Login button
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _doLogin,
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Log In',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 12),

                // Register link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text("Need an account? ",
                        style: TextStyle(color: Color(0xFFB5BAC1))),
                    GestureDetector(
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const RegisterPage()),
                      ),
                      child: const Text(
                        'Register',
                        style: TextStyle(
                            color: Color(0xFF5865F2),
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const ForgotPasswordPage()),
                  ),
                  child: const Text(
                    'Forgot your password?',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: Color(0xFF5865F2),
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
          color: Color(0xFFB5BAC1),
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5),
    );
  }
}