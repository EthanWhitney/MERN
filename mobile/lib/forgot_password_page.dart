import 'package:flutter/material.dart';
import 'package:mobile/api_service.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  // ── Step 1: Request reset code ─────────────────────────────────────────────

  Future<void> _doRequestReset() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showSnack('Please enter your email address.', isError: true);
      return;
    }

    setState(() => _isLoading = true);
    final res = await ApiService.requestPasswordReset(email);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      _showVerifyDialog(email);
    } else {
      _showSnack(
        res['error']?.toString() ?? 'Failed to send reset code.',
        isError: true,
      );
    }
  }

  // ── Step 2: Show verify-code dialog ───────────────────────────────────────

  void _showVerifyDialog(String email) {
    _codeController.clear();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _ResetVerifyDialog(
        email: email,
        codeController: _codeController,
        onVerify: (code) => _doVerifyCode(ctx, email, code),
        onResend: () => _doResendCode(email),
        onCancel: () => Navigator.pop(ctx),
      ),
    );
  }

  Future<void> _doVerifyCode(
      BuildContext dialogCtx, String email, String code) async {
    final res = await ApiService.verifyResetCode(email: email, code: code);
    if (!mounted) return;

    if (res['success'] == true) {
      Navigator.pop(dialogCtx); // close verify dialog
      _showNewPasswordDialog(email, code);
    } else {
      _showSnack(
        res['error']?.toString() ?? 'Invalid or expired code.',
        isError: true,
      );
    }
  }

  Future<void> _doResendCode(String email) async {
    final res = await ApiService.requestPasswordReset(email);
    if (!mounted) return;
    if (res['success'] == true) {
      _showSnack('A new code has been sent to your email!');
    } else {
      _showSnack(
        res['error']?.toString() ?? 'Failed to resend code.',
        isError: true,
      );
    }
  }

  // ── Step 3: Set new password dialog ───────────────────────────────────────

  void _showNewPasswordDialog(String email, String code) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _NewPasswordDialog(
        onSave: (newPassword) =>
            _doResetPassword(ctx, email, code, newPassword),
        onCancel: () => Navigator.pop(ctx),
      ),
    );
  }

  Future<void> _doResetPassword(BuildContext dialogCtx, String email,
      String code, String newPassword) async {
    final res = await ApiService.resetPassword(
      email: email,
      code: code,
      newPassword: newPassword,
    );
    if (!mounted) return;

    if (res['success'] == true) {
      Navigator.pop(dialogCtx); // close new-password dialog
      Navigator.pop(context); // go back to login
      _showSnack('Password updated! You can now log in.');
    } else {
      _showSnack(
        res['error']?.toString() ?? 'Failed to reset password.',
        isError: true,
      );
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
                const Icon(Icons.lock_reset_rounded,
                    size: 64, color: Color(0xFF5865F2)),
                const SizedBox(height: 16),
                const Text(
                  'Reset your password',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  "Enter your email and we'll send you a reset code.",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFFB5BAC1), fontSize: 14),
                ),
                const SizedBox(height: 32),

                _buildLabel('EMAIL'),
                const SizedBox(height: 6),
                TextField(
                  controller: _emailController,
                  style: const TextStyle(color: Colors.white),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _doRequestReset(),
                  decoration: const InputDecoration(),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _doRequestReset,
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text(
                            'Send Reset Code',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600),
                          ),
                  ),
                ),
                const SizedBox(height: 12),

                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Remember your password? ',
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
// Step 2 Dialog: Verify Reset Code  (matches RegisterPage _VerifyDialog style)
// ─────────────────────────────────────────────────────────────────────────────

class _ResetVerifyDialog extends StatefulWidget {
  final String email;
  final TextEditingController codeController;
  final Future<void> Function(String) onVerify;
  final Future<void> Function() onResend;
  final VoidCallback onCancel;

  const _ResetVerifyDialog({
    required this.email,
    required this.codeController,
    required this.onVerify,
    required this.onResend,
    required this.onCancel,
  });

  @override
  State<_ResetVerifyDialog> createState() => _ResetVerifyDialogState();
}

class _ResetVerifyDialogState extends State<_ResetVerifyDialog> {
  bool _isVerifying = false;
  bool _isResending = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF2B2D31),
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      title: const Text(
        'Check Your Email',
        style: TextStyle(
            color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
        textAlign: TextAlign.center,
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.mark_email_unread_outlined,
              color: Color(0xFF5865F2), size: 48),
          const SizedBox(height: 12),
          Text(
            'Enter the 6-digit code sent to ${widget.email}.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFFB5BAC1), fontSize: 13),
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
                    style: TextStyle(color: Color(0xFF5865F2), fontSize: 12),
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
                    final code = widget.codeController.text.trim();
                    if (code.length < 6) return;
                    setState(() => _isVerifying = true);
                    await widget.onVerify(code);
                    if (mounted) setState(() => _isVerifying = false);
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

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 Dialog: Set New Password
// ─────────────────────────────────────────────────────────────────────────────

class _NewPasswordDialog extends StatefulWidget {
  final Future<void> Function(String) onSave;
  final VoidCallback onCancel;

  const _NewPasswordDialog({required this.onSave, required this.onCancel});

  @override
  State<_NewPasswordDialog> createState() => _NewPasswordDialogState();
}

class _NewPasswordDialogState extends State<_NewPasswordDialog> {
  final _passController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePass = true;
  bool _obscureConfirm = true;
  bool _isSaving = false;

  @override
  void dispose() {
    _passController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Widget _buildLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(
          text,
          style: const TextStyle(
              color: Color(0xFFB5BAC1),
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF2B2D31),
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      title: const Text(
        'Set New Password',
        style: TextStyle(
            color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
        textAlign: TextAlign.center,
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.lock_outline_rounded,
              color: Color(0xFF5865F2), size: 48),
          const SizedBox(height: 12),
          const Text(
            'Choose a new password for your account.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFFB5BAC1), fontSize: 13),
          ),
          const SizedBox(height: 20),
          _buildLabel('NEW PASSWORD'),
          TextField(
            controller: _passController,
            obscureText: _obscurePass,
            style: const TextStyle(color: Colors.white),
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFF1E1F22),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: BorderSide.none,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePass ? Icons.visibility_off : Icons.visibility,
                  color: const Color(0xFF949BA4),
                  size: 20,
                ),
                onPressed: () =>
                    setState(() => _obscurePass = !_obscurePass),
              ),
            ),
          ),
          const SizedBox(height: 16),
          _buildLabel('CONFIRM PASSWORD'),
          TextField(
            controller: _confirmController,
            obscureText: _obscureConfirm,
            style: const TextStyle(color: Colors.white),
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFF1E1F22),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: BorderSide.none,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirm ? Icons.visibility_off : Icons.visibility,
                  color: const Color(0xFF949BA4),
                  size: 20,
                ),
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
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
            onPressed: _isSaving
                ? null
                : () async {
                    final pass = _passController.text;
                    final confirm = _confirmController.text;
                    if (pass.length < 6) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content:
                            Text('Password must be at least 6 characters.'),
                        backgroundColor: Color(0xFFED4245),
                        behavior: SnackBarBehavior.floating,
                      ));
                      return;
                    }
                    if (pass != confirm) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Passwords do not match.'),
                        backgroundColor: Color(0xFFED4245),
                        behavior: SnackBarBehavior.floating,
                      ));
                      return;
                    }
                    setState(() => _isSaving = true);
                    await widget.onSave(pass);
                    if (mounted) setState(() => _isSaving = false);
                  },
            child: _isSaving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Save Password'),
          ),
        ),
      ],
    );
  }
}