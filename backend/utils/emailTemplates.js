/**
 * Email template utilities for SendGrid
 */

/**
 * Generates HTML email template for verification code
 * @param {string} username - User's username
 * @param {string} verificationCode - 6-character verification code
 * @param {string} expirationMinutes - Minutes until code expires (default: 15)
 * @returns {string} HTML email content
 */
const getVerificationCodeEmailTemplate = (username, verificationCode, expirationMinutes = 15) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #333;
            margin: 0;
            font-size: 28px;
          }
          .content {
            color: #555;
            line-height: 1.6;
            font-size: 16px;
            margin-bottom: 30px;
          }
          .code-box {
            background-color: #f0f4ff;
            border-left: 4px solid #007bff;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
            border-radius: 4px;
          }
          .verification-code {
            font-size: 36px;
            font-weight: bold;
            color: #007bff;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .instructions {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #856404;
          }
          .expiration {
            color: #dc3545;
            font-weight: bold;
            margin-top: 15px;
          }
          .footer {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 30px;
            border-top: 1px solid #eee;
            padding-top: 20px;
          }
          .security-note {
            background-color: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #721c24;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          
          <div class="content">
            <p>Hi <strong>${username}</strong>,</p>
            <p>Welcome! To complete your account registration, please enter the verification code below:</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your verification code:</p>
              <div class="verification-code">${verificationCode}</div>
            </div>
            
            <div class="instructions">
              <strong>How to verify:</strong>
              <p style="margin: 10px 0 0 0;">1. Go to the verification page on our website<br>
              2. Enter the 6-character code shown above<br>
              3. Click "Verify" to activate your account</p>
            </div>
            
            <div class="expiration">
              ⏰ This code expires in ${expirationMinutes} minutes
            </div>
            
            <div class="security-note">
              <strong>🔒 Security Tip:</strong><br>
              Never share this code with anyone. We will never ask for this code via email or message.
            </div>
          </div>
          
          <div class="footer">
            <p>If you didn't request this code, please ignore this email.</p>
            <p>&copy; 2026 Syncord. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Generates plain text email template for verification code
 * @param {string} username - User's username
 * @param {string} verificationCode - 6-character verification code
 * @param {string} expirationMinutes - Minutes until code expires
 * @returns {string} Plain text email content
 */
const getVerificationCodeEmailTextTemplate = (username, verificationCode, expirationMinutes = 15) => {
  return `
Hi ${username},

Welcome! To complete your account registration, please enter the verification code below:

VERIFICATION CODE: ${verificationCode}

How to verify:
1. Go to the verification page on our website
2. Enter the 6-character code shown above
3. Click "Verify" to activate your account

This code expires in ${expirationMinutes} minutes.

SECURITY TIP:
Never share this code with anyone. We will never ask for this code via email or message.

If you didn't request this code, please ignore this email.

© 2026 Syncord. All rights reserved.
  `;
};

/**
 * Generates HTML email template for password reset code
 * @param {string} username - User's username
 * @param {string} resetCode - 6-character password reset code
 * @param {string} expirationMinutes - Minutes until code expires (default: 15)
 * @returns {string} HTML email content
 */
const getPasswordResetEmailTemplate = (username, resetCode, expirationMinutes = 15) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #28a745;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #333;
            margin: 0;
            font-size: 28px;
          }
          .content {
            color: #555;
            line-height: 1.6;
            font-size: 16px;
            margin-bottom: 30px;
          }
          .code-box {
            background-color: #f0fff4;
            border-left: 4px solid #28a745;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
            border-radius: 4px;
          }
          .reset-code {
            font-size: 36px;
            font-weight: bold;
            color: #28a745;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .instructions {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #856404;
          }
          .expiration {
            color: #dc3545;
            font-weight: bold;
            margin-top: 15px;
          }
          .footer {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 30px;
            border-top: 1px solid #eee;
            padding-top: 20px;
          }
          .security-note {
            background-color: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #721c24;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          
          <div class="content">
            <p>Hi <strong>${username}</strong>,</p>
            <p>We received a request to reset your password. To complete the password reset process, please enter the code below:</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your password reset code:</p>
              <div class="reset-code">${resetCode}</div>
            </div>
            
            <div class="instructions">
              <strong>How to reset your password:</strong>
              <p style="margin: 10px 0 0 0;">1. Go to the password reset page<br>
              2. Enter the 6-character code shown above<br>
              3. Enter your new password<br>
              4. Click "Reset Password" to complete</p>
            </div>
            
            <div class="expiration">
              ⏰ This code expires in ${expirationMinutes} minutes
            </div>
            
            <div class="security-note">
              <strong>🔒 Security Tip:</strong><br>
              Never share this code with anyone. We will never ask for this code via email or message.
            </div>
            
            <p style="margin-top: 20px; color: #666; font-size: 14px;">If you didn't request this password reset, please ignore this email and your account will remain secure.</p>
          </div>
          
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>&copy; 2026 Syncord. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Generates plain text email template for password reset code
 * @param {string} username - User's username
 * @param {string} resetCode - 6-character password reset code
 * @param {string} expirationMinutes - Minutes until code expires
 * @returns {string} Plain text email content
 */
const getPasswordResetEmailTextTemplate = (username, resetCode, expirationMinutes = 15) => {
  return `
Hi ${username},

We received a request to reset your password. To complete the password reset process, please enter the code below:

PASSWORD RESET CODE: ${resetCode}

How to reset your password:
1. Go to the password reset page
2. Enter the 6-character code shown above
3. Enter your new password
4. Click "Reset Password" to complete

This code expires in ${expirationMinutes} minutes.

SECURITY TIP:
Never share this code with anyone. We will never ask for this code via email or message.

If you didn't request this password reset, please ignore this email and your account will remain secure.

If you have any questions, please contact our support team.

© 2026 Syncord. All rights reserved.
  `;
};

module.exports = {
  getVerificationCodeEmailTemplate,
  getVerificationCodeEmailTextTemplate,
  getPasswordResetEmailTemplate,
  getPasswordResetEmailTextTemplate
};
