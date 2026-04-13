const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const { getVerificationCodeEmailTemplate, getVerificationCodeEmailTextTemplate } = require('../utils/emailTemplates');
require('dotenv').config();

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

// Get frontend base URL from environment or default to localhost
const getFrontendUrl = () => {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  // Default to localhost for development
  return 'http://localhost:3000';
};

// Ensure connection
if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// Send verification email
const sendVerificationEmail = async (req, res) => {
  const { email, username, verificationCode, token } = req.body;

  try {
    // Validate required fields
    if (!email || !username || (!verificationCode && !token)) {
      return res.status(400).json({
        success: false,
        error: 'Email, username, and verificationCode are required'
      });
    }

    let msg;

    // Preferred flow: code-based verification email using shared templates.
    if (verificationCode) {
      msg = {
        to: email,
        from: 'syncord.space@gmail.com',
        subject: 'Verify Your Email - Syncord',
        text: getVerificationCodeEmailTextTemplate(username, verificationCode, 15),
        html: getVerificationCodeEmailTemplate(username, verificationCode, 15)
      };
    } else {
      // Backward-compatible fallback for token-link verification.
      const frontendUrl = getFrontendUrl();
      const verificationLink = `${frontendUrl}/verify/${token}`;

      msg = {
        to: email,
        from: 'syncord.space@gmail.com',
        subject: 'Account Verification',
        text: `Hello ${username}, please verify your account by clicking the link: ${verificationLink}`,
        html: `
          <h2>Welcome ${username}!</h2>
          <p>Please verify your account by clicking the link below:</p>
          <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Verify Account
          </a>
          <p>Or copy and paste this link: ${verificationLink}</p>
          <p>This link will expire in 12000 seconds.</p>
        `
      };
    }

    // Send email using official SendGrid SDK
    await sgMail.send(msg);
    
    return res.status(200).json({ success: true, message: 'Verification email sent successfully' });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send verification email: ' + error.message });
  }
};

// Verify email token
const verifyEmail = async (req, res) => {
  const { token } = req.params;
  let error = '';

  try {
    // Validate token
    if (!token) {
      error = 'Token is required';
      return res.status(400).json({ success: false, error });
    }

    const db = client.db('discord_clone');

    // Find user by temporary token
    const user = await db.collection('users').findOne({ temporarytoken: token });

    if (!user) {
      error = 'Activation link has expired or is invalid';
      return res.status(401).json({ success: false, error });
    }

    // Verify JWT token
    const secretKey = process.env.JWT_SECRET;
    
    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        error = 'Activation link has expired';
        return res.status(401).json({ success: false, error });
      }

      // Update user's active status to true
      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(user._id) },
        { 
          $set: { 
            active: true,
            temporarytoken: null
          }
        }
      );

      if (result.modifiedCount > 0) {
        return res.status(200).json({ 
          success: true, 
          message: 'Email verified successfully. Your account is now active!' 
        });
      } else {
        error = 'Failed to activate account';
        return res.status(500).json({ success: false, error });
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Server error: ' + e.message });
  }
};

module.exports = {
  sendVerificationEmail,
  verifyEmail
};
