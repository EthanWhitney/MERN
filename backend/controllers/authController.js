const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');

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

    if (existingUser) {
      error = 'Email or username already exists';
      return res.status(409).json({ userId: null, error });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user object
    const newUser = {
      email: email.toLowerCase(),
      username: username,
      hashedPassword: hashedPassword,
      profilePicture: '',
      servers: [],
      friends: [],
      createdAt: new Date()
    };

    // Insert user into database
    const result = await db.collection('users').insertOne(newUser);
    userId = result.insertedId;

    return res.status(201).json({ userId: userId.toString(), error: '' });
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

    return res.status(200).json({
      userId: user._id.toString(),
      username: user.username,
      error: ''
    });
  }
  catch (e) {
    error = e.toString();
    return res.status(500).json({ userId: null, username: '', error });
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
