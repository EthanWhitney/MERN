const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// add friend 
// POST /api/users/:userId/friends/:friendId
const addFriend = async (req, res) => {
  const { userId, friendId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(friendId)) {
      error = 'Invalid user ID(s)';
      return res.status(400).json({ friends: [], error });
    }

    if (userId === friendId) {
      error = 'Cannot add yourself as a friend';
      return res.status(400).json({ friends: [], error });
    }

    const db = client.db('discord_clone');
    const userObjId = new ObjectId(userId);
    const friendObjId = new ObjectId(friendId);

    const [user, friend] = await Promise.all([
      db.collection('users').findOne({ _id: userObjId }),
      db.collection('users').findOne({ _id: friendObjId }),
    ]);

    if (!user || !friend) {
      error = 'User not found';
      return res.status(404).json({ friends: [], error });
    }

    const alreadyFriends = (user.friends || []).some(id => id.toString() === friendId);
    if (alreadyFriends) {
      error = 'Already friends';
      return res.status(409).json({ friends: [], error });
    }

    // add each user to the others friends list
    await Promise.all([
      db.collection('users').updateOne({ _id: userObjId }, { $addToSet: { friends: friendObjId } }),
      db.collection('users').updateOne({ _id: friendObjId }, { $addToSet: { friends: userObjId } }),
    ]);

    const updatedUser = await db.collection('users').findOne({ _id: userObjId });
    const friendIds = updatedUser.friends || [];
    const friendProfiles = await db
      .collection('users')
      .find({ _id: { $in: friendIds } })
      .project({ username: 1, profilePicture: 1 })
      .toArray();

    return res.status(200).json({ friends: friendProfiles, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ friends: [], error });
  }
};

// remove friend 
// DELETE /api/users/:userId/friends/:friendId
const removeFriend = async (req, res) => {
  const { userId, friendId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(friendId)) {
      error = 'Invalid user ID(s)';
      return res.status(400).json({ friends: [], error });
    }

    const db = client.db('discord_clone');
    const userObjId = new ObjectId(userId);
    const friendObjId = new ObjectId(friendId);

    const user = await db.collection('users').findOne({ _id: userObjId });
    if (!user) {
      error = 'User not found';
      return res.status(404).json({ friends: [], error });
    }

    // remove each user from the others friends list
    await Promise.all([
      db.collection('users').updateOne({ _id: userObjId }, { $pull: { friends: friendObjId } }),
      db.collection('users').updateOne({ _id: friendObjId }, { $pull: { friends: userObjId } }),
    ]);

    const updatedUser = await db.collection('users').findOne({ _id: userObjId });
    const friendIds = updatedUser.friends || [];
    const friendProfiles = await db
      .collection('users')
      .find({ _id: { $in: friendIds } })
      .project({ username: 1, profilePicture: 1 })
      .toArray();

    return res.status(200).json({ friends: friendProfiles, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ friends: [], error });
  }
};

// get all friends for a user
// GET /api/users/:userId/friends
const getFriends = async (req, res) => {
  const { userId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(userId)) {
      error = 'Invalid user ID';
      return res.status(400).json({ friends: [], error });
    }

    const db = client.db('discord_clone');
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      error = 'User not found';
      return res.status(404).json({ friends: [], error });
    }

    const friendIds = user.friends || [];
    const friendProfiles = await db
      .collection('users')
      .find({ _id: { $in: friendIds } })
      .project({ username: 1, profilePicture: 1 })
      .toArray();

    return res.status(200).json({ friends: friendProfiles, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ friends: [], error });
  }
};

module.exports = { addFriend, removeFriend, getFriends };