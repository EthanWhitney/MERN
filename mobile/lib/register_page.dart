import 'package:flutter/material.dart';
import 'package:mobile/api_service.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passController = TextEditingController();
  final _codeController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _pendingUserId;

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _passController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  // ── Register ──────────────────────────────────────────────────────────────

  Future<void> _doRegister() async {
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passController.text;

    if (username.isEmpty || email.isEmpty || password.isEmpty) {
      _showSnack('Please fill in all fields.', isError: true);
      return;
    }
    if (password.length < 6) {
      _showSnack('Password must be at least 6 characters.', isError: true);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final result =
          await ApiService.register(username, email, password);
      if (!mounted) return;

      if (result['error'] != null &&
          result['error'].toString().isNotEmpty) {
        _showSnack(result['error'].toString(), isError: true);
        return;
      }

      _pendingUserId = result['userId']?.toString();
      _showVerificationDialog();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Verification dialog ───────────────────────────────────────────────────

  void _showVerificationDialog() {
    _codeController.clear();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _VerifyDialog(
        codeController: _codeController,
        onVerify: _verifyCode,
        onResend: _resendCode,
        onCancel: () => Navigator.pop(ctx),
      ),
    );
  }

  Future<void> _verifyCode(String code) async {
    if (_pendingUserId == null) return;
    final result =
        await ApiService.verifyEmail(_pendingUserId!, code);
    if (!mounted) return;

    if (result['success'] == true) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      _showSnack('Email verified! You can now log in.');
    } else {
      _showSnack(
          result['error']?.toString() ?? 'Verification failed.',
          isError: true);
    }
  }

  Future<void> _resendCode() async {
    if (_pendingUserId == null) return;
    final result =
        await ApiService.resendVerificationCode(_pendingUserId!);
    if (!mounted) return;
    if (result.containsKey('error')) {
      _showSnack(result['error'].toString(), isError: true);
    } else {
      _showSnack('A new code has been sent to your email!');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor:
          isError ? const Color(0xFFED4245) : const Color(0xFF23A559),
      behavior: SnackBarBehavior.floating,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ));
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF111827),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF949BA4)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.forum_rounded,
                    size: 64, color: Color(0xFF5865F2)),
                const SizedBox(height: 16),
                const Text(
                  'Create an account',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  "Join Syncord today!",
                  textAlign: TextAlign.center,
                  style:
                      TextStyle(color: Color(0xFFB5BAC1), fontSize: 14),
                ),
                const SizedBox(height: 32),

                // USERNAME
                _buildLabel('USERNAME'),
                const SizedBox(height: 6),
                TextField(
                  controller: _usernameController,
                  style: const TextStyle(color: Colors.white),
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(),
                ),
                const SizedBox(height: 20),

                // EMAIL
                _buildLabel('EMAIL'),
                const SizedBox(height: 6),
                TextField(
                  controller: _emailController,
                  style: const TextStyle(color: Colors.white),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(),
                ),
                const SizedBox(height: 20),

                // PASSWORD
                _buildLabel('PASSWORD'),
                const SizedBox(height: 6),
                TextField(
                  controller: _passController,
                  obscureText: _obscurePassword,
                  style: const TextStyle(color: Colors.white),
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _doRegister(),
                  decoration: InputDecoration(
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility,
                        color: const Color(0xFF949BA4),
                        size: 20,
                      ),
                      onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Register button
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _doRegister,
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white),
                          )
                        : const Text('Continue',
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 12),

                // Back to login
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Already have an account? ',
                        style: TextStyle(color: Color(0xFFB5BAC1))),
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: const Text(
                        'Log In',
                        style: TextStyle(
                            color: Color(0xFF5865F2),
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
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

// ─────────────────────────────────────────────────────────────────────────────
// Verify Email Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _VerifyDialog extends StatefulWidget {
  final TextEditingController codeController;
  final Future<void> Function(String) onVerify;
  final Future<void> Function() onResend;
  final VoidCallback onCancel;

  const _VerifyDialog({
    required this.codeController,
    required this.onVerify,
    required this.onResend,
    required this.onCancel,
  });

  @override
  State<_VerifyDialog> createState() => _VerifyDialogState();
}

class _VerifyDialogState extends State<_VerifyDialog> {
  bool _isVerifying = false;
  bool _isResending = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF2B2D31),
      surfaceTintColor: Colors.transparent,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      title: const Text(
        'Verify Your Email',
        style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20),
        textAlign: TextAlign.center,
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.mark_email_unread_outlined,
              color: Color(0xFF5865F2), size: 48),
          const SizedBox(height: 12),
          const Text(
            'Enter the 6-digit code sent to your email address.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFFB5BAC1), fontSize: 13),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: widget.codeController,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 6,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              letterSpacing: 8,
              fontWeight: FontWeight.bold,
            ),
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFF1E1F22),
              counterText: '',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _isResending
                ? null
                : () async {
                    setState(() => _isResending = true);
                    await widget.onResend();
                    if (mounted) setState(() => _isResending = false);
                  },
            child: _isResending
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Color(0xFF5865F2)),
                  )
                : const Text(
                    "Didn't get a code? Resend",
                    style: TextStyle(
                        color: Color(0xFF5865F2), fontSize: 12),
                  ),
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        TextButton(
          onPressed: widget.onCancel,
          child: const Text('Cancel',
              style: TextStyle(color: Color(0xFF949BA4))),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 40,
          child: ElevatedButton(
            onPressed: _isVerifying
                ? null
                : () async {
                    final code =
                        widget.codeController.text.trim();
                    if (code.length < 6) return;
                    setState(() => _isVerifying = true);
                    await widget.onVerify(code);
                    if (mounted)
                      setState(() => _isVerifying = false);
                  },
            child: _isVerifying
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Verify'),
          ),
        ),
      ],
    );
  }
}
