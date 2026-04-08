const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const jwtManager = require('../createJWT');
const { generateVerificationCode } = require('../utils/codeGenerator');
const sgMail = require('@sendgrid/mail');
const { getVerificationCodeEmailTemplate, getVerificationCodeEmailTextTemplate } = require('../utils/emailTemplates');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

// Ensure connection
if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// Update profile picture
const updateProfilePicture = async (req, res) => {
  const userId = req.userId;
  const { profilePicture } = req.body;
  let error = '';

  if (!profilePicture) {
    error = 'Profile picture is required';
    return res.status(400).json({ success: false, error });
  }

  try {
    const db = client.db('discord_clone');

    const updateResult = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { profilePicture: profilePicture } }
    );

    if (updateResult.matchedCount === 0) {
      error = 'User not found';
      return res.status(404).json({ success: false, error });
    }

    return res.status(200).json({ success: true, profilePicture, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

module.exports = {
  updateProfilePicture
};
