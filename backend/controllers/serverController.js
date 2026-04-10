const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}



// create new discord server
// POST /api/servers
const createServer = async (req, res) => {
  const { serverName, description } = req.body;
  const ownerId = req.user.userId; // Get from verified token
  let error = '';

  try {
    if (!serverName) {
      error = 'serverName is required';
      return res.status(400).json({ server: null, error });
    }

    const ownerObjId = toObjectId(ownerId);
    if (!ownerObjId) {
      return res.status(400).json({ server: null, error: 'Invalid user authentication' });
    }

    const db = client.db('discord_clone');

    // Check if server name already exists
    const existingServer = await db.collection('servers').findOne({ 
      serverName: { $regex: new RegExp(`^${serverName}$`, 'i') } 
    });
    
    if (existingServer) {
      error = 'A server with this name already exists';
      return res.status(409).json({ server: null, error });
    }

    const owner = await db.collection('users').findOne({ _id: ownerObjId });
    if (!owner) {
      error = 'Owner user not found';
      return res.status(404).json({ server: null, error });
    }

    const newServer = {
      serverName,
      description: description || '',
      serverIcon: '',
      ownerId: ownerId,
      members: [ownerId],
      roles: [],
      textChannels: [],
      voiceChannels: [],
      createdAt: new Date(),
    };

    const result = await db.collection('servers').insertOne(newServer);
    const serverId = result.insertedId;

    // add server to owners servers list
    await db.collection('users').updateOne(
      { _id: ownerObjId },
      { $addToSet: { servers: serverId } }
    );

    return res.status(201).json({ server: { ...newServer, _id: serverId }, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ server: null, error });
  }
};

// get a server by id
// GET /api/servers/:serverId
const getServer = async (req, res) => {
  const { serverId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ server: null, error });
    }

    const db = client.db('discord_clone');
    const server = await db.collection('servers').findOne({ _id: new ObjectId(serverId) });

    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ server: null, error });
    }

    return res.status(200).json({ server, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ server: null, error });
  }
};

// update server settings
// PATCH /api/servers/:serverId
const updateServer = async (req, res) => {
  const { serverId } = req.params;
  const { serverName, serverIcon, description } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ server: null, error });
    }

    const updates = {};
    if (serverName !== undefined) updates.serverName = serverName;
    if (serverIcon !== undefined) updates.serverIcon = serverIcon;
    if (description !== undefined) updates.description = description;

    const db = client.db('discord_clone');

    const existing = await db.collection('servers').findOne({ _id: new ObjectId(serverId) });
    if (!existing) {
      error = 'Server not found';
      return res.status(404).json({ server: null, error });
    }

    await db.collection('servers').updateOne({ _id: new ObjectId(serverId) }, { $set: updates });
    const updated = await db.collection('servers').findOne({ _id: new ObjectId(serverId) });

    return res.status(200).json({ server: updated, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ server: null, error });
  }
};

// delete a server (owner only)
// DELETE /api/servers/:serverId
const deleteServer = async (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.userId; // Get from verified token
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ message: '', error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);

    const server = await db.collection('servers').findOne({ _id: serverObjId });
    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ message: '', error });
    }

    // Verify that the user is the server owner
    if (server.ownerId !== userId) {
      error = 'Only the server owner can delete this server';
      return res.status(403).json({ message: '', error });
    }

    // remove server from all members servers array
    await db.collection('users').updateMany(
      { servers: serverObjId },
      { $pull: { servers: serverObjId } }
    );

    // delete the server and all related data
    await Promise.all([
      db.collection('servers').deleteOne({ _id: serverObjId }),
      db.collection('serverProfiles').deleteMany({ serverId: serverObjId }),
      db.collection('serverRoles').deleteMany({ serverId: serverObjId }),
      db.collection('textChannels').deleteMany({ serverId: serverObjId }),
      db.collection('messages').deleteMany({ serverId: serverObjId }),
    ]);

    return res.status(200).json({ message: 'Server deleted successfully', error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ message: '', error });
  }
};

// get all servers a user belongs to
// GET /api/users/servers
const getUserServers = async (req, res) => {
  const userId = req.user.userId; // Get from verified token
  let error = '';

  try {
    if (!ObjectId.isValid(userId)) {
      error = 'Invalid user ID';
      return res.status(400).json({ servers: [], error });
    }

    const db = client.db('discord_clone');
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      error = 'User not found';
      return res.status(404).json({ servers: [], error });
    }

    const serverIds = user.servers || [];
    const servers = await db
      .collection('servers')
      .find({ _id: { $in: serverIds } })
      .toArray();

    return res.status(200).json({ servers, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ servers: [], error });
  }
};

const userHasServerAccess = (server, userObjectId) => {
  if (!server || !userObjectId) {
    return false;
  }

  const userIdString = userObjectId.toString();
  const isOwner = server.serverOwnerUserID && String(server.serverOwnerUserID) === userIdString;
  const isMember = (server.members || []).some((memberId) => String(memberId) === userIdString);

  return isOwner || isMember;
};

// create a text channel in a server
// POST /api/servers/:serverId/textChannels
const createTextChannel = async (req, res) => {
  const { serverId } = req.params;
  const { channelName, topic, userId } = req.body;
  let error = '';

  try {
    const serverObjId = toObjectId(serverId);
    const creatorObjId = toObjectId(userId);

    if (!serverObjId) {
      error = 'Invalid server ID';
      return res.status(400).json({ channel: null, error });
    }

    if (!creatorObjId) {
      error = 'Invalid user ID';
      return res.status(400).json({ channel: null, error });
    }

    const resolvedName = (channelName || '').trim();
    if (!resolvedName) {
      error = 'channelName is required';
      return res.status(400).json({ channel: null, error });
    }

    const db = client.db('discord_clone');
    const server = await db.collection('servers').findOne({ _id: serverObjId });

    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ channel: null, error });
    }

    const isOwner = server.ownerId && server.ownerId.toString() === creatorObjId.toString();
    if (!isOwner) {
      error = 'Only the server owner can create channels';
      return res.status(403).json({ channel: null, error });
    }

    const channelDoc = {
      channelID: new ObjectId(),
      name: resolvedName,
      topic: topic || '',
      createdAt: new Date(),
    };

    await db.collection('servers').updateOne(
      { _id: serverObjId },
      { $push: { textChannels: channelDoc } }
    );

    return res.status(201).json({ channel: channelDoc, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ channel: null, error });
  }
};

// delete a text channel from a server
// DELETE /api/servers/:serverId/textChannels/:channelId
const deleteTextChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  const { userId } = req.body;
  let error = '';

  try {
    const serverObjId = toObjectId(serverId);
    const channelObjId = toObjectId(channelId);
    const userObjId = toObjectId(userId);

    if (!serverObjId) {
      error = 'Invalid server ID';
      return res.status(400).json({ success: false, error });
    }

    if (!channelObjId) {
      error = 'Invalid channel ID';
      return res.status(400).json({ success: false, error });
    }

    if (!userObjId) {
      error = 'Invalid user ID';
      return res.status(400).json({ success: false, error });
    }

    const db = client.db('discord_clone');
    const server = await db.collection('servers').findOne({ _id: serverObjId });

    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ success: false, error });
    }

    const isOwner = server.ownerId && server.ownerId.toString() === userObjId.toString();
    if (!isOwner) {
      error = 'Only the server owner can delete channels';
      return res.status(403).json({ success: false, error });
    }

    // Remove channel from textChannels array
    const result = await db.collection('servers').updateOne(
      { _id: serverObjId },
      { $pull: { textChannels: { channelID: channelObjId } } }
    );

    if (result.modifiedCount === 0) {
      error = 'Channel not found in server';
      return res.status(404).json({ success: false, error });
    }

    return res.status(200).json({ success: true, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ success: false, error });
  }
};

module.exports = { createServer, getServer, updateServer, deleteServer, getUserServers, createTextChannel, deleteTextChannel };

function toObjectId(id) {
  if (!id || !ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}