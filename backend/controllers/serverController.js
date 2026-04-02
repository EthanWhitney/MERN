const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// create new discord server
// POST /api/servers
const createServer = async (req, res) => {
  const { serverName, description, ownerId } = req.body;
  let error = '';

  try {
    if (!serverName || !ownerId) {
      error = 'serverName and ownerId are required';
      return res.status(400).json({ server: null, error });
    }

    if (!ObjectId.isValid(ownerId)) {
      error = 'Invalid ownerId';
      return res.status(400).json({ server: null, error });
    }

    const db = client.db('discord_clone');
    const ownerObjId = new ObjectId(ownerId);

    const owner = await db.collection('users').findOne({ _id: ownerObjId });
    if (!owner) {
      error = 'Owner user not found';
      return res.status(404).json({ server: null, error });
    }

    const newServer = {
      serverName,
      description: description || '',
      serverIcon: '',
      ownerId: ownerObjId,
      members: [ownerObjId],
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
    const result = await db.collection('servers').findOneAndUpdate(
      { _id: new ObjectId(serverId) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      error = 'Server not found';
      return res.status(404).json({ server: null, error });
    }

    return res.status(200).json({ server: result.value, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ server: null, error });
  }
};

// delete a server (owner only)
// DELETE /api/servers/:serverId
const deleteServer = async (req, res) => {
  const { serverId } = req.params;
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
// GET /api/users/:userId/servers
const getUserServers = async (req, res) => {
  const { userId } = req.params;
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

module.exports = { createServer, getServer, updateServer, deleteServer, getUserServers };