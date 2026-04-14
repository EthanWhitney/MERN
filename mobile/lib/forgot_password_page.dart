import 'package:flutter/material.dart';
import 'package:mobile/api_service.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _emailController = TextEditingController();
  final _passController = TextEditingController();
  final _confirmPassController = TextEditingController();
  final _codeController = TextEditingController();
  bool _isLoading = false;

  Future<void> _doRecover() async {
    final email = _emailController.text.trim();
    final pass = _passController.text;
    if (email.isEmpty || pass.isEmpty) {
      _showSnack('Email and New Password are required.', isError: true);
      return;
    }
    if (pass != _confirmPassController.text) {
      _showSnack('Passwords do not match.', isError: true);
      return;
    }

    setState(() => _isLoading = true);
    final res = await ApiService.requestPasswordReset(email);
    setState(() => _isLoading = false);

    if (res['error'] == null || res['error'] == '') {
      _showVerifyDialog(email);
    } else {
      _showSnack(res['error'].toString(), isError: true);
    }
  }

  void _showVerifyDialog(String email) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _ResetVerifyDialog(
        codeController: _codeController,
        onVerify: (code) async {
          final res = await ApiService.verifyResetAndChangePassword(
            login: email,
            code: code,
            newPassword: _passController.text,
          );
          if (res['error'] == null || res['error'] == '') {
            Navigator.pop(context); // Close dialog
            Navigator.pop(context); // Go back to login
            _showSnack('Password updated!');
          } else {
            _showSnack(res['error'].toString(), isError: true);
          }
        },
        onCancel: () => Navigator.pop(context),
      ),
    );
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? const Color(0xFFED4245) : const Color(0xFF23A559),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF111827),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Reset Password', textAlign: TextAlign.center, 
              style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 32),
            _buildLabel('EMAIL'),
            _buildTextField(_emailController, false),
            const SizedBox(height: 16),
            _buildLabel('NEW PASSWORD'),
            _buildTextField(_passController, true),
            const SizedBox(height: 16),
            _buildLabel('CONFIRM PASSWORD'),
            _buildTextField(_confirmPassController, true),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _doRecover,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF5865F2)),
              child: _isLoading ? const CircularProgressIndicator() : const Text('Send Reset Code'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String t) => Text(t, style: const TextStyle(color: Color(0xFFB5BAC1), fontSize: 12, fontWeight: FontWeight.bold));
  Widget _buildTextField(TextEditingController c, bool o) => TextField(controller: c, obscureText: o, style: const TextStyle(color: Colors.white));
}

// Custom Dialog to match your RegisterPage style
class _ResetVerifyDialog extends StatelessWidget {
  final TextEditingController codeController;
  final Function(String) onVerify;
  final VoidCallback onCancel;

  const _ResetVerifyDialog({required this.codeController, required this.onVerify, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF313338),
      title: const Text('Enter Code', style: TextStyle(color: Colors.white)),
      content: TextField(controller: codeController, style: const TextStyle(color: Colors.white)),
      actions: [
        TextButton(onPressed: onCancel, child: const Text('Cancel')),
        ElevatedButton(onPressed: () => onVerify(codeController.text.trim()), child: const Text('Reset')),
      ],
    );
  }
}