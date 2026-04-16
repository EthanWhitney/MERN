const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const jwtManager = require('../createJWT');
const { generateVerificationCode } = require('../utils/codeGenerator');
const sgMail = require('@sendgrid/mail');
const { getVerificationCodeEmailTemplate, getVerificationCodeEmailTextTemplate } = require('../utils/emailTemplates');
const socketManager = require('../utils/socketManager');

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

  if (profilePicture === undefined) {
    error = 'Profile picture field is required';
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

    // ========== PHASE 5.1: Broadcast profile picture change ==========
    await socketManager.broadcastProfilePictureChanged(db, userId, profilePicture);

    return res.status(200).json({ success: true, profilePicture, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

// Migrate avatar formats from .png to .jpg
const migrateAvatarFormats = async (req, res) => {
  let error = '';

  try {
    const db = client.db('discord_clone');

    // Update users collection - replace .png with .jpg in profilePicture
    const usersResult = await db.collection('users').updateMany(
      {
        profilePicture: { $exists: true, $ne: '' },
        profilePicture: /\.png$/i
      },
      [
        {
          $set: {
            profilePicture: {
              $replaceAll: {
                input: '$profilePicture',
                find: '.png',
                replacement: '.jpg'
              }
            }
          }
        }
      ]
    );

    // Update serverProfiles collection - replace .png with .jpg in serverSpecificPFP
    const serverProfilesResult = await db.collection('serverProfiles').updateMany(
      {
        serverSpecificPFP: { $exists: true, $ne: '' },
        serverSpecificPFP: /\.png$/i
      },
      [
        {
          $set: {
            serverSpecificPFP: {
              $replaceAll: {
                input: '$serverSpecificPFP',
                find: '.png',
                replacement: '.jpg'
              }
            }
          }
        }
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Avatar formats migrated from PNG to JPG',
      usersUpdated: usersResult.modifiedCount,
      serverProfilesUpdated: serverProfilesResult.modifiedCount,
      error: ''
    });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

module.exports = {
  updateProfilePicture,
  migrateAvatarFormats
};
