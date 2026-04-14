const { MongoClient, ObjectId } = require('mongodb');
const { makeConversationKey } = require('../services/chatThreadService');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

/**
 * Delete all direct messages between two users
 * @param {string} userId - The ID of the user removing the friend
 * @param {string} friendId - The ID of the friend being removed
 * @returns {Promise<{success: boolean, deletedCount: number, error?: string}>}
 */
const deleteFriendMessages = async (userId, friendId) => {
  try {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(friendId)) {
      return { success: false, deletedCount: 0, error: 'Invalid user IDs' };
    }

    const db = client.db('discord_clone');
    const conversationKey = makeConversationKey(userId, friendId);

    // Delete all messages in this conversation
    const result = await db.collection('directMessages').deleteMany({
      conversationKey: conversationKey
    });

    return {
      success: true,
      deletedCount: result.deletedCount || 0,
      error: ''
    };
  } catch (e) {
    return {
      success: false,
      deletedCount: 0,
      error: e.toString()
    };
  }
};

module.exports = {
  deleteFriendMessages
};
