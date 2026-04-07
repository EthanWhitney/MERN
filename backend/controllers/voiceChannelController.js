const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// POST /api/servers/:serverId/voiceChannels
const createVoiceChannel = async (req, res) => {
  const { serverId } = req.params;
  const { channelName, voiceRoles } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ channel: null, error });
    }
    if (!channelName) {
      error = 'channelName is required';
      return res.status(400).json({ channel: null, error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);

    const server = await db.collection('servers').findOne({ _id: serverObjId });
    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ channel: null, error });
    }

    const newChannel = {
      serverId: serverObjId,
      channelName,
      voiceRoles: voiceRoles || [],
      activeMembers: [],
      createdAt: new Date(),
    };

    const result = await db.collection('voiceChannels').insertOne(newChannel);

    await db.collection('servers').updateOne(
      { _id: serverObjId },
      { $push: { voiceChannels: result.insertedId } }
    );

    return res.status(201).json({
      channel: { ...newChannel, _id: result.insertedId },
      error: '',
    });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ channel: null, error });
  }
};

// GET /api/servers/:serverId/voiceChannels
const getVoiceChannels = async (req, res) => {
  const { serverId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ channels: [], error });
    }

    const db = client.db('discord_clone');
    const channels = await db.collection('voiceChannels')
      .find({ serverId: new ObjectId(serverId) })
      .toArray();

    return res.status(200).json({ channels, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ channels: [], error });
  }
};

// PATCH /api/servers/:serverId/voiceChannels/:channelId
const updateVoiceChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  const { channelName, voiceRoles } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ channel: null, error });
    }

    const db = client.db('discord_clone');
    const channelObjId = new ObjectId(channelId);
    const serverObjId = new ObjectId(serverId);

    const existing = await db.collection('voiceChannels').findOne({
      _id: channelObjId,
      serverId: serverObjId,
    });
    if (!existing) {
      error = 'Voice channel not found';
      return res.status(404).json({ channel: null, error });
    }

    const updates = {};
    if (channelName !== undefined) updates.channelName = channelName;
    if (voiceRoles !== undefined) updates.voiceRoles = voiceRoles;

    await db.collection('voiceChannels').updateOne(
      { _id: channelObjId, serverId: serverObjId },
      { $set: updates }
    );

    const updated = await db.collection('voiceChannels').findOne({
      _id: channelObjId,
    });

    return res.status(200).json({ channel: updated, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ channel: null, error });
  }
};

// DELETE /api/servers/:serverId/voiceChannels/:channelId
const deleteVoiceChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ message: '', error });
    }

    const db = client.db('discord_clone');
    const channelObjId = new ObjectId(channelId);
    const serverObjId = new ObjectId(serverId);

    await Promise.all([
      db.collection('voiceChannels').deleteOne({
        _id: channelObjId,
        serverId: serverObjId,
      }),
      db.collection('servers').updateOne(
        { _id: serverObjId },
        { $pull: { voiceChannels: channelObjId } }
      ),
    ]);

    return res.status(200).json({ message: 'Voice channel deleted successfully', error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ message: '', error });
  }
};

// POST /api/servers/:serverId/voiceChannels/:channelId/join
const joinVoiceChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  const { userId } = req.body;
  let error = '';

  try {
    if (
      !ObjectId.isValid(serverId) ||
      !ObjectId.isValid(channelId) ||
      !ObjectId.isValid(userId)
    ) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ channel: null, error });
    }

    const db = client.db('discord_clone');
    const channelObjId = new ObjectId(channelId);
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);

    const channel = await db.collection('voiceChannels').findOne({
      _id: channelObjId,
      serverId: serverObjId,
    });
    if (!channel) {
      error = 'Voice channel not found';
      return res.status(404).json({ channel: null, error });
    }

    // Remove user from any other voice channel in this server first
    await db.collection('voiceChannels').updateMany(
      { serverId: serverObjId },
      { $pull: { activeMembers: userObjId } }
    );

    // Add user to this channel
    await db.collection('voiceChannels').updateOne(
      { _id: channelObjId },
      { $addToSet: { activeMembers: userObjId } }
    );

    const updated = await db.collection('voiceChannels').findOne({ _id: channelObjId });

    return res.status(200).json({ channel: updated, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ channel: null, error });
  }
};

// DELETE /api/servers/:serverId/voiceChannels/:channelId/leave
const leaveVoiceChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  const { userId } = req.body;
  let error = '';

  try {
    if (
      !ObjectId.isValid(serverId) ||
      !ObjectId.isValid(channelId) ||
      !ObjectId.isValid(userId)
    ) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ channel: null, error });
    }

    const db = client.db('discord_clone');
    const channelObjId = new ObjectId(channelId);
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);

    const channel = await db.collection('voiceChannels').findOne({
      _id: channelObjId,
      serverId: serverObjId,
    });
    if (!channel) {
      error = 'Voice channel not found';
      return res.status(404).json({ channel: null, error });
    }

    await db.collection('voiceChannels').updateOne(
      { _id: channelObjId },
      { $pull: { activeMembers: userObjId } }
    );

    const updated = await db.collection('voiceChannels').findOne({ _id: channelObjId });

    return res.status(200).json({ channel: updated, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ channel: null, error });
  }
};

module.exports = {
  createVoiceChannel,
  getVoiceChannels,
  updateVoiceChannel,
  deleteVoiceChannel,
  joinVoiceChannel,
  leaveVoiceChannel,
};