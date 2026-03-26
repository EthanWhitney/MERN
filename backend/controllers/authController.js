const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const jwtManager = require('../createJWT');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

// Ensure connection
if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// Register a new user
const register = async (req, res) => {
  const { username, password, email } = req.body;
  let error = '';
  let userId = null;

  try {
    // Validate required fields
    if (!username || !password || !email) {
      error = 'Username, password, and email are required';
      return res.status(400).json({ userId: null, error });
    }

    const db = client.db('discord_clone');

    // Check if user already exists (by email or username)
    const existingUser = await db.collection('users').findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    });

    if (existingUser && existingUser.active) {
      error = 'An account with that email or username already exists';
      return res.status(409).json({ userId: null, error });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate JWT token for email verification
    const secretKey = process.env.JWT_SECRET;
    const payload = {
      email: email.toLowerCase(),
      username: username
    };
    const temporarytoken = jwt.sign(payload, secretKey, { expiresIn: 12000 });

    let userId;

    // If user exists but is not active, update their record
    if (existingUser && !existingUser.active) {
      const result = await db.collection('users').updateOne(
        { _id: existingUser._id },
        {
          $set: {
            username: username,
            hashedPassword: hashedPassword,
            temporarytoken: temporarytoken,
            active: false,
            createdAt: new Date()
          }
        }
      );
      userId = existingUser._id;
    } else {
      // Create new user object
      const newUser = {
        email: email.toLowerCase(),
        username: username,
        hashedPassword: hashedPassword,
        profilePicture: '',
        servers: [],
        friends: [],
        temporarytoken: temporarytoken,
        active: false,
        createdAt: new Date()
      };

      // Insert user into database
      const result = await db.collection('users').insertOne(newUser);
      userId = result.insertedId;
    }

    return res.status(201).json({ 
      userId: userId.toString(), 
      temporarytoken: temporarytoken,
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
  const { emailOrUsername, password } = req.body;
  let error = '';

  try {
    // Validate required fields
    if (!emailOrUsername || !password) {
      error = 'Email or username and password are required';
      return res.status(400).json({ userId: null, username: '', error });
    }

    const db = client.db('discord_clone');

    // Find user by email or username
    const user = await db.collection('users').findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername }
      ]
    });

    if (!user) {
      error = 'Invalid email/username or password';
      return res.status(401).json({ userId: null, username: '', error });
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordMatch) {
      error = 'Invalid email/username or password';
      return res.status(401).json({ userId: null, username: '', error });
    }

    // Check if user is active (email verified)
    if (!user.active) {
      error = 'Please verify your email before logging in';
      return res.status(401).json({ userId: null, username: '', accessToken: '', error });
    }

    // Generate JWT access token
    const tokenResult = jwtManager.createToken(user._id.toString(), user.email, user.username);
    
    if (tokenResult.error) {
      error = tokenResult.error;
      return res.status(500).json({ userId: null, username: '', accessToken: '', error });
    }

    return res.status(200).json({
      userId: user._id.toString(),
      username: user.username,
      accessToken: tokenResult.accessToken,
      error: ''
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ userId: null, username: '', accessToken: '', error });
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



module.exports = {
  register,
  login,
  getUserProfile
};
