const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const jwtManager = require('../createJWT');
const { generateVerificationCode } = require('../utils/codeGenerator');
const sgMail = require('@sendgrid/mail');
const { getVerificationCodeEmailTemplate, getVerificationCodeEmailTextTemplate } = require('../utils/emailTemplates');

require('dotenv').config();

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

// Ensure connection
if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// Register a new user - creates unverified account
const register = async (req, res) => {
  const { password, email } = req.body;
  const username = req.body.username ? req.body.username.trim().toLowerCase() : '';
  let error = '';
  let userId = null;

  try {
    // Validate required fields
    if (!username || !password || !email) {
      error = 'Username, password, and email are required';
      return res.status(400).json({ userId: null, error });
    }

    const db = client.db('discord_clone');

    // Check if user already exists in main users collection (case-insensitive)
    const existingVerifiedUser = await db.collection('users').findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: { $regex: `^${username}$`, $options: 'i' } }
      ]
    });

    if (existingVerifiedUser && existingVerifiedUser.active) {
      error = 'An account with that email or username already exists';
      return res.status(409).json({ userId: null, error });
    }

    // Check if already pending verification (case-insensitive)
    const existingUnverifiedUser = await db.collection('unverifiedUsers').findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: { $regex: `^${username}$`, $options: 'i' } }
      ]
    });

    if (existingUnverifiedUser) {
      error = 'Account with this email or username is already pending verification. Please check your email or try again later.';
      return res.status(409).json({ userId: null, error });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Set expiration time (15 minutes from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    // Create unverified user object
    const unverifiedUser = {
      email: email.toLowerCase(),
      username: username,
      hashedPassword: hashedPassword,
      verificationCode: verificationCode,
      createdAt: now,
      expiresAt: expiresAt
    };

    // Insert into unverifiedUsers collection
    const result = await db.collection('unverifiedUsers').insertOne(unverifiedUser);
    userId = result.insertedId.toString();

    // Send verification email
    try {
      const emailHtml = getVerificationCodeEmailTemplate(username, verificationCode, 15);
      const emailText = getVerificationCodeEmailTextTemplate(username, verificationCode, 15);

      const msg = {
        to: email.toLowerCase(),
        from: 'syncord.space@gmail.com',
        subject: 'Verify Your Email - Syncord',
        text: emailText,
        html: emailHtml
      };

      await sgMail.send(msg);
    } catch (emailError) {
      // Continue anyway - user can still enter code if they captured it
    }

    return res.status(201).json({ 
      userId: userId,
      error: '' 
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ userId: null, error });
  }
};

// Login user
const login = async (req, res) => {
  const { password } = req.body;
  const emailOrUsername = req.body.emailOrUsername ? req.body.emailOrUsername.trim().toLowerCase() : '';
  let error = '';

  try {
    // Validate required fields
    if (!emailOrUsername || !password) {
      error = 'Email or username and password are required';
      return res.status(400).json({ userId: null, username: '', error });
    }

    const db = client.db('discord_clone');

    // Find user by email or username (case-insensitive for username)
    const user = await db.collection('users').findOne({
      $or: [
        { email: emailOrUsername },
        { username: { $regex: `^${emailOrUsername}$`, $options: 'i' } }
      ]
    });

    if (!user) {
      // Debug: Check if user exists in unverifiedUsers instead
      const unverifiedUser = await db.collection('unverifiedUsers').findOne({
        $or: [
          { email: emailOrUsername },
          { username: { $regex: `^${emailOrUsername}$`, $options: 'i' } }
        ]
      });
      
      if (unverifiedUser) {
        error = 'Account exists but email is not verified. Please check your email for the verification code.';
        return res.status(401).json({ userId: null, username: '', error });
      }
      
      error = 'Invalid email/username or password';
      return res.status(401).json({ userId: null, username: '', error });
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordMatch) {
      error = 'Invalid email/username or password';
      return res.status(401).json({ userId: null, username: '', error });
    }

    // Generate access + refresh tokens
    const tokenResult = jwtManager.createTokenPair(user._id.toString(), user.email, user.username);
    if (tokenResult.error) {
      error = tokenResult.error;
      return res.status(500).json({ userId: null, username: '', accessToken: '', refreshToken: '', error });
    }

    return res.status(200).json({
      userId: user._id.toString(),
      username: user.username,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      error: ''
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ userId: null, username: '', accessToken: '', refreshToken: '', error });
  }
};

// Logout user
const logout = async (req, res) => {
  const userId = req.userId;
  let error = '';

  try {
    if (!userId) {
      error = 'User ID not found in request';
      return res.status(400).json({ error });
    }

    const db = client.db('discord_clone');

    // Verify user exists
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Note: Online status is now managed by socket.io disconnect, not by explicit logout
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ error });
  }
};

const getUserProfile = async (req, res) => {
  const { userId } = req.body;
  let error = '';

  try {
    // Validate required fields
    if (!userId) {
      error = 'Invalid user ID';
      return res.status(400).json({ userId: null, username: '', error });
    }

    const db = client.db('discord_clone');

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      error = 'User with the provided ID does not exist';
      return res.status(401).json({ userId: null, username: '', error });
    }

    return res.status(200).json({
      username: user.username,
      profilePicture: user.profilePicture,
      error: ''
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ userId: null, username: '', error });
  }
};

// Verify email with code
const verifyEmail = async (req, res) => {
  const { userId, verificationCode } = req.body;
  let error = '';

  try {
    // Validate required fields
    if (!userId || !verificationCode) {
      error = 'User ID and verification code are required';
      return res.status(400).json({ success: false, error });
    }

    const db = client.db('discord_clone');

    // Find unverified user by ID
    let unverifiedUser;
    try {
      unverifiedUser = await db.collection('unverifiedUsers').findOne({ 
        _id: new ObjectId(userId) 
      });
    } catch (idError) {
      error = 'Invalid user ID format';
      return res.status(400).json({ success: false, error });
    }

    if (!unverifiedUser) {
      error = 'Verification code has expired or user not found. Please register again.';
      return res.status(401).json({ success: false, error });
    }

    // Check if code has expired
    if (new Date() > new Date(unverifiedUser.expiresAt)) {
      // Delete expired entry
      await db.collection('unverifiedUsers').deleteOne({ _id: new ObjectId(userId) });
      error = 'Verification code has expired. Please register again.';
      return res.status(401).json({ success: false, error });
    }

    // Check if code matches
    if (verificationCode.toUpperCase() !== unverifiedUser.verificationCode.toUpperCase()) {
      error = 'Invalid verification code. Please try again.';
      return res.status(401).json({ success: false, error });
    }

    // Code is valid - copy to main users collection
    const newUser = {
      email: unverifiedUser.email,
      username: unverifiedUser.username,
      hashedPassword: unverifiedUser.hashedPassword,
      profilePicture: '',
      servers: [],
      friends: [],
      active: true,
      createdAt: unverifiedUser.createdAt
    };

    // Insert into users collection
    const insertResult = await db.collection('users').insertOne(newUser);
    const newUserId = insertResult.insertedId.toString();

    // Delete from unverifiedUsers collection
    await db.collection('unverifiedUsers').deleteOne({ _id: new ObjectId(userId) });

    // Generate access + refresh tokens
    const tokenResult = jwtManager.createTokenPair(newUserId, newUser.email, newUser.username);
    
    if (tokenResult.error) {
      error = tokenResult.error;
      return res.status(500).json({ success: false, error });
    }

    return res.status(200).json({ 
      success: true,
      userId: newUserId,
      username: newUser.username,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      error: '' 
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;
  let error = '';

  try {
    if (!refreshToken) {
      error = 'refreshToken is required';
      return res.status(400).json({ accessToken: '', refreshToken: '', error });
    }

    const refreshResult = jwtManager.refreshFromRefreshToken(refreshToken);
    if (refreshResult.error) {
      return res.status(401).json({ accessToken: '', refreshToken: '', error: 'Invalid or expired refresh token' });
    }

    const db = client.db('discord_clone');
    const user = await db.collection('users').findOne({ _id: new ObjectId(refreshResult.userId) });
    if (!user) {
      return res.status(401).json({ accessToken: '', refreshToken: '', error: 'User no longer exists' });
    }

    const tokenResult = jwtManager.createTokenPair(user._id.toString(), user.email, user.username);
    if (tokenResult.error) {
      return res.status(500).json({ accessToken: '', refreshToken: '', error: tokenResult.error });
    }

    return res.status(200).json({
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      error: '',
    });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ accessToken: '', refreshToken: '', error });
  }
};

// Resend verification code
const resendVerificationCode = async (req, res) => {
  const { userId } = req.body;
  let error = '';

  try {
    // Validate required fields
    if (!userId) {
      error = 'User ID is required';
      return res.status(400).json({ success: false, error });
    }

    const db = client.db('discord_clone');

    // Find unverified user
    let unverifiedUser;
    try {
      unverifiedUser = await db.collection('unverifiedUsers').findOne({ 
        _id: new ObjectId(userId) 
      });
    } catch (idError) {
      error = 'Invalid user ID format';
      return res.status(400).json({ success: false, error });
    }

    if (!unverifiedUser) {
      error = 'User not found or verification already completed';
      return res.status(404).json({ success: false, error });
    }

    // Generate new verification code
    const newVerificationCode = generateVerificationCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    // Update unverified user with new code
    await db.collection('unverifiedUsers').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          verificationCode: newVerificationCode,
          expiresAt: expiresAt
        }
      }
    );

    // Send new verification email
    try {
      const emailHtml = getVerificationCodeEmailTemplate(unverifiedUser.username, newVerificationCode, 15);
      const emailText = getVerificationCodeEmailTextTemplate(unverifiedUser.username, newVerificationCode, 15);

      const msg = {
        to: unverifiedUser.email,
        from: 'syncord.space@gmail.com',
        subject: 'Verify Your Email - Syncord',
        text: emailText,
        html: emailHtml
      };

      await sgMail.send(msg);
    } catch (emailError) {
      // Continue anyway - user still has new code
    }

    return res.status(200).json({ 
      success: true,
      message: 'Verification code has been resent to your email',
      error: '' 
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

// Recover stuck account - move from unverified to verified without needing code
const recoverAccount = async (req, res) => {
  const { emailOrUsername } = req.body;
  let error = '';

  try {
    if (!emailOrUsername) {
      error = 'Email or username is required';
      return res.status(400).json({ success: false, error });
    }

    const searchString = emailOrUsername.trim().toLowerCase();
    const db = client.db('discord_clone');

    // Find unverified user (case-insensitive username search)
    const unverifiedUser = await db.collection('unverifiedUsers').findOne({
      $or: [
        { email: searchString },
        { username: { $regex: `^${searchString}$`, $options: 'i' } }
      ]
    });

    if (!unverifiedUser) {
      // Check if already verified (case-insensitive username search)
      const verifiedUser = await db.collection('users').findOne({
        $or: [
          { email: searchString },
          { username: { $regex: `^${searchString}$`, $options: 'i' } }
        ]
      });
      
      if (verifiedUser) {
        error = 'Account is already verified. Try logging in.';
        return res.status(400).json({ success: false, error });
      }

      error = 'No account found with that email or username';
      return res.status(404).json({ success: false, error });
    }

    // Move account from unverified to users collection
    const newUser = {
      email: unverifiedUser.email,
      username: unverifiedUser.username,
      hashedPassword: unverifiedUser.hashedPassword,
      profilePicture: '',
      servers: [],
      friends: [],
      friendRequests: [],
      active: true,
      createdAt: unverifiedUser.createdAt
    };

    const insertResult = await db.collection('users').insertOne(newUser);
    const userId = insertResult.insertedId.toString();

    // Delete from unverified collection
    await db.collection('unverifiedUsers').deleteOne({ _id: unverifiedUser._id });

    return res.status(200).json({
      success: true,
      message: 'Account recovered successfully. You can now log in.',
      userId: userId,
      username: newUser.username,
      error: ''
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

// DELETE /api/users/:userId - Delete user account and all associated data
const deleteAccount = async (req, res) => {
  const { userId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(userId)) {
      error = 'Invalid user ID';
      return res.status(400).json({ success: false, error });
    }

    const db = client.db('discord_clone');
    const userObjId = new ObjectId(userId);

    // Check if user exists
    const user = await db.collection('users').findOne({ _id: userObjId });
    if (!user) {
      error = 'User not found';
      return res.status(404).json({ success: false, error });
    }

    // 1. Remove user from all servers (they're a member of)
    await db.collection('servers').updateMany(
      { members: userObjId },
      { $pull: { members: userObjId } }
    );

    // 2. Delete all serverProfiles for this user
    await db.collection('serverProfiles').deleteMany({ userId: userObjId });

    // 3. Delete all servers owned by this user and get their IDs
    const ownedServers = await db.collection('servers').find({ ownerId: userObjId }).toArray();
    const ownedServerIds = ownedServers.map(s => s._id);
    await db.collection('servers').deleteMany({ ownerId: userObjId });

    // 4. Remove user from friends lists of other users
    await db.collection('users').updateMany(
      { friends: userObjId },
      { $pull: { friends: userObjId } }
    );

    // 5. Remove only OWNED servers (deleted servers) from friends' user documents
    if (ownedServerIds.length > 0) {
      await db.collection('users').updateMany(
        { servers: { $in: ownedServerIds } },
        { $pull: { servers: { $in: ownedServerIds } } }
      );
    }

    // 6. Delete all direct messages involving this user
    await db.collection('directMessages').deleteMany({
      $or: [
        { senderId: userObjId },
        { recieverId: userObjId },
        { senderID: userObjId },
        { recipientID: userObjId }
      ]
    });

    // 7. Delete all friend requests involving this user
    await db.collection('friendRequests').deleteMany({
      $or: [
        { senderId: userObjId },
        { recipientId: userObjId }
      ]
    });

    // 8. For server messages: Replace sender info with "Deleted User" instead of deleting
    //    This preserves conversation context and message history
    await db.collection('messages').updateMany(
      { senderId: userObjId },
      {
        $set: {
          senderId: null,
          senderID: null,
          sender: {
            username: '[Deleted User]',
            profilePicture: '',
            _id: null
          }
        }
      }
    );

    // 9. Delete the user account
    await db.collection('users').deleteOne({ _id: userObjId });

    return res.status(200).json({ success: true, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

module.exports = {
  register,
  login,
  logout,
  getUserProfile,
  verifyEmail,
  resendVerificationCode,
  refreshAccessToken,
  recoverAccount,
  deleteAccount
};
