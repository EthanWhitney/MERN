import { useState } from "react";
import { requestPasswordReset, verifyResetCode, resetPassword } from "../utils/passwordResetApi";
import "./PasswordReset.css";


function PasswordReset() {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: email, 2: code, 3: new password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  async function handleRequestReset(e: any): Promise<void> {
    e.preventDefault();
    if (!email.trim()) {
      setMessage('Please enter your email address');
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);

    if (result.success) {
      setMessage('');
      setSuccessMessage('');
      setStep(2);
    } else {
      setMessage(result.error || 'Failed to request password reset');
    }
  }

  async function handleVerifyCode(e: any): Promise<void> {
    e.preventDefault();
    if (!code.trim()) {
      setMessage('Please enter the verification code');
      return;
    }

    if (code.length !== 6) {
      setMessage('Verification code must be 6 characters');
      return;
    }

    setLoading(true);
    const result = await verifyResetCode(email, code);
    setLoading(false);

    if (result.success) {
      setMessage('');
      setSuccessMessage('');
      setStep(3);
    } else {
      setMessage(result.error || 'Failed to verify code');
    }
  }

  async function handleResetPassword(e: any): Promise<void> {
    e.preventDefault();
    if (!newPassword.trim()) {
      setMessage('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await resetPassword(email, code, newPassword);
    setLoading(false);

    if (result.success) {
      setMessage('');
      setSuccessMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else {
      setMessage(result.error || 'Failed to reset password');
    }
  }

  function handleBackToEmail(): void {
    setStep(1);
    setCode('');
    setMessage('');
  }

  function handleBackToCode(): void {
    setStep(2);
    setNewPassword('');
    setConfirmPassword('');
    setMessage('');
  }

  return (
    <div id="passwordResetDiv">
      <span id="inner-title">RESET PASSWORD</span><br />

      {step === 1 && (
        <>
          <input
            type="email"
            id="resetEmail"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          /><br />

          <input
            type="submit"
            id="requestResetButton"
            className="buttons"
            value={loading ? "Sending..." : "Send Reset Code"}
            onClick={handleRequestReset}
            disabled={loading}
          />

          <span id="passwordResetResult">{message || successMessage}</span><br />

          <a href="/login">Back to Login</a>
        </>
      )}

      {step === 2 && (
        <>
          <span id="stepLabel">Email: {email}</span><br />

          <input
            type="text"
            id="resetCode"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            disabled={loading}
          /><br />

          <input
            type="submit"
            id="verifyCodeButton"
            className="buttons"
            value={loading ? "Verifying..." : "Verify Code"}
            onClick={handleVerifyCode}
            disabled={loading}
          />

          <input
            type="submit"
            id="backtoEmailButton"
            className="buttons"
            value="Back"
            onClick={handleBackToEmail}
            disabled={loading}
          />

          <span id="passwordResetResult">{message || successMessage}</span><br />
        </>
      )}

      {step === 3 && (
        <>
          <span id="stepLabel">Email: {email}</span><br />

          <input
            type="password"
            id="newPassword"
            placeholder="New password (minimum 6 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          /><br />

          <input
            type="password"
            id="confirmPassword"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          /><br />

          <input
            type="submit"
            id="resetPasswordButton"
            className="buttons"
            value={loading ? "Resetting..." : "Reset Password"}
            onClick={handleResetPassword}
            disabled={loading}
          />

          <input
            type="submit"
            id="backtoCodeButton"
            className="buttons"
            value="Back"
            onClick={handleBackToCode}
            disabled={loading}
          />

          <span id="passwordResetResult">{message || successMessage}</span><br />
        </>
      )}
    </div>
  );
}

export default PasswordReset;
