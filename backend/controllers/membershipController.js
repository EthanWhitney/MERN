const { MongoClient, ObjectId } = require('mongodb');
const socketManager = require('../utils/socketManager');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// POST /api/servers/:serverId/join
const joinServer = async (req, res) => {
  const { serverId } = req.params;
  const { userId } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(userId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ serverProfile: null, error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);

    const [server, user] = await Promise.all([
      db.collection('servers').findOne({ _id: serverObjId }),
      db.collection('users').findOne({ _id: userObjId }),
    ]);

    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ serverProfile: null, error });
    }
    if (!user) {
      error = 'User not found';
      return res.status(404).json({ serverProfile: null, error });
    }

    const alreadyMember = await db.collection('serverProfiles').findOne({
      serverId: serverObjId,
      userId: userObjId,
    });

    if (alreadyMember) {
      error = 'User is already a member of this server';
      return res.status(409).json({ serverProfile: null, error });
    }

    const newProfile = {
      userId: userObjId,
      serverId: serverObjId,
      serverSpecificName: user.username,
      roles: [],
      isServerMuted: false,
      isServerDeafened: false,
      isTimedOut: false,
      joinedAt: new Date(),
    };

    const result = await db.collection('serverProfiles').insertOne(newProfile);

    await Promise.all([
      db.collection('servers').updateOne(
        { _id: serverObjId },
        { $addToSet: { members: userObjId } }
      ),
      db.collection('users').updateOne(
        { _id: userObjId },
        { $addToSet: { servers: serverId } }
      ),
    ]);

    return res.status(201).json({
      serverProfile: { ...newProfile, _id: result.insertedId },
      error: '',
    });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ serverProfile: null, error });
  }
};

// DELETE /api/servers/:serverId/leave
const leaveServer = async (req, res) => {
  const { serverId } = req.params;
  const { userId } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(userId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ message: '', error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);

    await Promise.all([
      db.collection('serverProfiles').deleteOne({
        serverId: serverObjId,
        userId: userObjId,
      }),
      db.collection('servers').updateOne(
        { _id: serverObjId },
        { $pull: { members: userObjId } }
      ),
      db.collection('users').updateOne(
        { _id: userObjId },
        { $pull: { servers: serverObjId } }
      ),
    ]);

    return res.status(200).json({ message: 'Left server successfully', error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ message: '', error });
  }
};

// GET /api/servers/:serverId/members
const getServerMembers = async (req, res) => {
  const { serverId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ members: [], error });
    }

    const db = client.db('discord_clone');
    const members = await db.collection('serverProfiles')
      .find({ serverId: new ObjectId(serverId) })
      .toArray();

    return res.status(200).json({ members, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ members: [], error });
  }
};

// GET /api/servers/:serverId/members/profiles
// Returns enriched member profiles (userId, username, profilePicture, serverSpecificName)
const getServerMemberProfiles = async (req, res) => {
  const { serverId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ members: [], error });
    }

    const db = client.db('discord_clone');
    const serverProfiles = await db.collection('serverProfiles')
      .find({ serverId: new ObjectId(serverId) })
      .toArray();

    if (serverProfiles.length === 0) {
      return res.status(200).json({ members: [], error: '' });
    }

    // Enrich with user data (username, profilePicture)
    const userIds = serverProfiles.map(p => p.userId);
    const users = await db.collection('users')
      .find({ _id: { $in: userIds } })
      .project({ _id: 1, username: 1, profilePicture: 1 })
      .toArray();

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const members = serverProfiles.map(p => {
      const user = userMap[p.userId.toString()] || {};
      return {
        userId: p.userId.toString(),
        username: user.username || p.serverSpecificName || 'Unknown',
        profilePicture: user.profilePicture || '',
        serverSpecificName: p.serverSpecificName || '',
      };
    });

    return res.status(200).json({ members, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ members: [], error });
  }
};

// GET /api/servers/:serverId/members/online
// Returns the subset of member userIds that are currently connected via socket
const getOnlineMembers = async (req, res) => {
  const { serverId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ onlineUserIds: [], error });
    }

    const db = client.db('discord_clone');
    const profiles = await db.collection('serverProfiles')
      .find({ serverId: new ObjectId(serverId) })
      .project({ userId: 1 })
      .toArray();

    const memberIds = profiles.map(p => p.userId.toString());
    // Filter to only the ones that have an active socket connection
    const onlineUserIds = memberIds.filter(id => !!socketManager.getUserSocketId(id));

    return res.status(200).json({ onlineUserIds, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ onlineUserIds: [], error });
  }
};

// PATCH /api/servers/:serverId/profile/:userId
const updateServerProfile = async (req, res) => {
  const { serverId, userId } = req.params;
  const { serverSpecificName, isServerMuted, isServerDeafened, isTimedOut } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(userId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ serverProfile: null, error });
    }

    const updates = {};
    if (serverSpecificName !== undefined) updates.serverSpecificName = serverSpecificName;
    if (isServerMuted !== undefined) updates.isServerMuted = isServerMuted;
    if (isServerDeafened !== undefined) updates.isServerDeafened = isServerDeafened;
    if (isTimedOut !== undefined) updates.isTimedOut = isTimedOut;

    const db = client.db('discord_clone');
    const result = await db.collection('serverProfiles').findOneAndUpdate(
      { serverId: new ObjectId(serverId), userId: new ObjectId(userId) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      error = 'Server profile not found';
      return res.status(404).json({ serverProfile: null, error });
    }

    return res.status(200).json({ serverProfile: result, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ serverProfile: null, error });
  }
};

// POST /api/servers/:serverId/members/:userId/roles/:roleId
const assignRole = async (req, res) => {
  const { serverId, userId, roleId } = req.params;
  let error = '';

  try {
    if (
      !ObjectId.isValid(serverId) ||
      !ObjectId.isValid(userId) ||
      !ObjectId.isValid(roleId)
    ) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ serverProfile: null, error });
    }

    const db = client.db('discord_clone');
    const roleObjId = new ObjectId(roleId);

    const role = await db.collection('serverRoles').findOne({
      _id: roleObjId,
      serverId: new ObjectId(serverId),
    });

    if (!role) {
      error = 'Role not found in this server';
      return res.status(404).json({ serverProfile: null, error });
    }

    const result = await db.collection('serverProfiles').findOneAndUpdate(
      { serverId: new ObjectId(serverId), userId: new ObjectId(userId) },
      { $addToSet: { roles: roleObjId } },
      { returnDocument: 'after' }
    );

    if (!result) {
      error = 'Server profile not found';
      return res.status(404).json({ serverProfile: null, error });
    }

    return res.status(200).json({ serverProfile: result, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ serverProfile: null, error });
  }
};

// DELETE /api/servers/:serverId/members/:userId/roles/:roleId
const removeRole = async (req, res) => {
  const { serverId, userId, roleId } = req.params;
  let error = '';

  try {
    if (
      !ObjectId.isValid(serverId) ||
      !ObjectId.isValid(userId) ||
      !ObjectId.isValid(roleId)
    ) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ serverProfile: null, error });
    }

    const db = client.db('discord_clone');
    const result = await db.collection('serverProfiles').findOneAndUpdate(
      { serverId: new ObjectId(serverId), userId: new ObjectId(userId) },
      { $pull: { roles: new ObjectId(roleId) } },
      { returnDocument: 'after' }
    );

    if (!result) {
      error = 'Server profile not found';
      return res.status(404).json({ serverProfile: null, error });
    }

    return res.status(200).json({ serverProfile: result, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ serverProfile: null, error });
  }
};

module.exports = {
  joinServer,
  leaveServer,
  getServerMembers,
  getServerMemberProfiles,
  getOnlineMembers,
  updateServerProfile,
  assignRole,
  removeRole,
};
