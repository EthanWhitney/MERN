import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildPath } from "../utils/config";
import { storeTokens } from "../utils/tokenStorage";

function VerifyCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pendingUserId = useMemo(() => localStorage.getItem('pending_verification_user_id') || '', []);
  const pendingEmail = useMemo(() => localStorage.getItem('pending_verification_email') || '', []);

  async function handleVerify(event: any): Promise<void> {
    event.preventDefault();

    if (!pendingUserId) {
      setMessage('No pending verification found. Please register again.');
      return;
    }

    if (!code || code.trim().length !== 6) {
      setMessage('Enter the 6-character verification code.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(buildPath('api/auth/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUserId,
          verificationCode: code.trim().toUpperCase()
        })
      });

      const data = await response.json();

      if (!data.success) {
        setMessage(data.error || 'Verification failed');
        return;
      }

      // Store auth tokens and user context after successful verification
      storeTokens(data.accessToken, data.refreshToken);
      localStorage.setItem('user_data', JSON.stringify({ username: data.username, id: data.userId }));
      localStorage.removeItem('pending_verification_user_id');
      localStorage.removeItem('pending_verification_email');

      setMessage('Verification successful. Redirecting...');
      setTimeout(() => navigate('/friends'), 500);
    } catch (error: any) {
      console.error('Verify code error:', error);
      setMessage('Unable to verify right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode(): Promise<void> {
    if (!pendingUserId) {
      setMessage('No pending verification found. Please register again.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(buildPath('api/auth/resend-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId })
      });

      const data = await response.json();

      if (!data.success) {
        setMessage(data.error || 'Failed to resend code');
        return;
      }

      setMessage('A new verification code was sent to your email.');
    } catch (error: any) {
      console.error('Resend code error:', error);
      setMessage('Unable to resend code right now.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div id="verifyCodeDiv">
      <span id="inner-title">VERIFY YOUR ACCOUNT</span><br />

      <p>
        Enter the 6-character code sent to: <strong>{pendingEmail || 'your email'}</strong>
      </p>

      <input
        type="text"
        id="verificationCode"
        placeholder="6-character code"
        value={code}
        maxLength={6}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      /><br />

      <input
        type="submit"
        id="verifyCodeButton"
        className="buttons"
        value={isLoading ? 'Please wait...' : 'Verify Code'}
        onClick={handleVerify}
        disabled={isLoading}
      />

      <br />
      <button id="resendCodeButton" onClick={handleResendCode} disabled={isLoading}>
        Resend Code
      </button>

      <br />
      <button id="backToRegisterButton" onClick={() => navigate('/register')}>
        Back to Register
      </button>

      <span id="verifyCodeResult">{message}</span>
    </div>
  );
}

export default VerifyCode;
