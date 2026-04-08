const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// send friend req
// POST /api/users/friends/:friendId
const sendFriendRequest = async (req, res) => {
  const senderId = req.userId;
  const { friendId } = req.params;

  try {
    if (!ObjectId.isValid(friendId)) return res.status(400).json({ error: 'Invalid ID' });

    const db = client.db('discord_clone');
    const senderObjId = new ObjectId(senderId);
    const friendObjId = new ObjectId(friendId);

    if (senderId === friendId) return res.status(400).json({ error: "Can't add yourself" });

    // fetch both users to check current status
    const [sender, recipient] = await Promise.all([
      db.collection('users').findOne({ _id: senderObjId }),
      db.collection('users').findOne({ _id: friendObjId })
    ]);

    if (!recipient) return res.status(404).json({ error: 'User not found' });

    // are they already friends?
    const alreadyFriends = sender.friends?.some(id => id.equals(friendObjId));
    if (alreadyFriends) return res.status(400).json({ error: 'Already friends' });

    const hasIncomingFromThem = sender.friendRequests?.some(req => req.from.equals(friendObjId));
    
    if (hasIncomingFromThem) {
        await acceptFriendRequest(req, res); 
        return; 
    }

    const alreadySent = recipient.friendRequests?.some(req => req.from.equals(senderObjId));
    if (alreadySent) return res.status(400).json({ error: 'Request already pending' });

    // push the request
    await db.collection('users').updateOne(
      { _id: friendObjId },
      { $addToSet: { friendRequests: { from: senderObjId, status: 'pending' } } }
    );

    return res.status(200).json({ message: 'Request sent!' });
  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
};

const acceptFriendRequest = async (req, res) => {
  const userId = req.userId;
  const { friendId } = req.params;

  try {
    const db = client.db('discord_clone');
    const userObjId = new ObjectId(userId);
    const friendObjId = new ObjectId(friendId);

    // update both users: add to friends, rem from pending
    await Promise.all([
      db.collection('users').updateOne({ _id: userObjId }, { 
        $addToSet: { friends: friendObjId },
        $pull: { friendRequests: { from: friendObjId } } 
      }),
      db.collection('users').updateOne({ _id: friendObjId }, { 
        $addToSet: { friends: userObjId } 
      })
    ]);

    return res.status(200).json({ message: 'Friend request accepted!' });
  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
};

// remove friend 
// DELETE /api/users/friends/:friendId
const removeFriend = async (req, res) => {
  const userId = req.userId;
  const { friendId } = req.params;
  let error = '';

  try {
    if (!userId || !ObjectId.isValid(userId) || !ObjectId.isValid(friendId)) {
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
      db.collection('users').updateOne({ _id: userObjId }, { 
        $pull: { friends: friendObjId, friendRequests: { from: friendObjId } } 
      }),
      db.collection('users').updateOne({ _id: friendObjId }, { 
        $pull: { friends: userObjId, friendRequests: { from: userObjId } } 
      })
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
  // Use authenticated userId from token, not from URL params
  const userId = req.userId;
  let error = '';

  try {
    console.log('getFriends called with userId:', userId);
    
    if (!userId || !ObjectId.isValid(userId)) {
      error = 'Invalid user ID';
      console.error('Invalid userId:', userId);
      return res.status(400).json({ friends: [], error });
    }

    const db = client.db('discord_clone');
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      error = 'User not found';
      console.error('User not found in database for userId:', userId);
      return res.status(404).json({ friends: [], error });
    }

    console.log('Found user:', user.username, 'with friends:', user.friends?.length || 0);

    const friendIds = user.friends || [];
    const friendProfiles = await db
      .collection('users')
      .find({ _id: { $in: friendIds } })
      .project({ _id: 1, username: 1, profilePicture: 1 })
      .toArray();

    console.log('Returning', friendProfiles.length, 'friends');
    return res.status(200).json({ friends: friendProfiles, error: '' });
  } catch (e) {
    error = e.toString();
    console.error('Error in getFriends:', error);
    return res.status(500).json({ friends: [], error });
  }
};

// search user by username
// GET /api/users/search?username=xxx
const searchUserByUsername = async (req, res) => {
  const { username } = req.query;
  
  try {
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ user: null, error: 'Username is required' });
    }

    const db = client.db('discord_clone');

    const searchName = username.trim().toLowerCase();

    const user = await db.collection('users').findOne({
      username: searchName
    });

    if (!user) {
      return res.status(404).json({ user: null, error: 'User not found' });
    }

    // Don't return sensitive info, just what's needed for friend operations
    return res.status(200).json({
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture || '',
      },
      error: '',
    });
  } catch (e) {
    console.error('Error in searchUserByUsername:', e.toString());
    return res.status(500).json({ user: null, error: e.toString() });
  }
};

const getPendingRequests = async (req, res) => {
  const userId = req.userId;

  try {
    const db = client.db('discord_clone');
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user || !user.friendRequests) {
      return res.status(200).json({ requests: [] });
    }

    // get the profiles for everyone who sent a request
    const requesterIds = user.friendRequests.map(r => r.from);
    const profiles = await db.collection('users')
      .find({ _id: { $in: requesterIds } })
      .project({ username: 1, profilePicture: 1 })
      .toArray();

    return res.status(200).json({ requests: profiles });
  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
};

module.exports = { 
  sendFriendRequest, 
  acceptFriendRequest, 
  removeFriend, 
  getFriends, 
  searchUserByUsername,
  getPendingRequests
};