const { MongoClient, ObjectId } = require('mongodb');
const {
  broadcastVoiceChannelCreated,
  broadcastVoiceChannelDeleted,
  broadcastUserJoinedVoiceChannel,
  broadcastUserSwappedVoiceChannel,
  broadcastUserLeftVoiceChannel,
} = require('../utils/socketManager');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// POST /api/servers/:serverId/voiceChannels
const createVoiceChannel = async (req, res) => {
  console.log('[createVoiceChannel] Request received');
  console.log('[createVoiceChannel] Params:', req.params);
  console.log('[createVoiceChannel] Body:', req.body);
  console.log('[createVoiceChannel] User:', req.user);
  
  const { serverId } = req.params;
  const { channelName, voiceRoles } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ channel: null, error });
    }
    if (!channelName || !channelName.trim()) {
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
      channelName: channelName.trim(),
      voiceRoles: voiceRoles || [],
      activeMembers: [],
      createdAt: new Date(),
    };

    const result = await db.collection('voiceChannels').insertOne(newChannel);

    await db.collection('servers').updateOne(
      { _id: serverObjId },
      { $push: { voiceChannels: result.insertedId } }
    );

    const createdChannel = { ...newChannel, _id: result.insertedId };
    
    // Broadcast voice channel creation to all server members
    await broadcastVoiceChannelCreated(db, serverObjId, createdChannel);

    console.log('[createVoiceChannel] Channel created successfully:', result.insertedId);
    return res.status(201).json({
      channel: createdChannel,
      error: '',
    });
  } catch (e) {
    console.error('[createVoiceChannel Error]', e);
    console.error('[createVoiceChannel Error] Stack:', e.stack);
    error = e.message || e.toString();
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

    // Broadcast voice channel deletion to all server members
    await broadcastVoiceChannelDeleted(db, serverObjId, channelObjId);

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

    // Get user data for broadcast
    const user = await db.collection('users').findOne(
      { _id: userObjId },
      { projection: { username: 1, profilePicture: 1 } }
    );

    // Check if user is in another voice channel in this server
    const currentChannelWithUser = await db.collection('voiceChannels').findOne({
      serverId: serverObjId,
      activeMembers: userObjId,
      _id: { $ne: channelObjId }
    });

    let isSwapping = false;
    let isSwappingAcrossServers = false;
    let oldServerId = null;
    let oldChannelId = null;

    if (currentChannelWithUser) {
      // Same-server swap
      isSwapping = true;
      // Remove user from any other voice channel in this server
      await db.collection('voiceChannels').updateMany(
        { serverId: serverObjId },
        { $pull: { activeMembers: userObjId } }
      );
      
      // Broadcast swap event
      await broadcastUserSwappedVoiceChannel(
        db,
        serverObjId,
        currentChannelWithUser._id,
        channelObjId,
        userObjId,
        user
      );
    } else {
      // Check if user is in a voice channel in a DIFFERENT server (cross-server swap)
      const oldChannelAnyServer = await db.collection('voiceChannels').findOne({
        activeMembers: userObjId,
        _id: { $ne: channelObjId }
      });

      if (oldChannelAnyServer && oldChannelAnyServer.serverId.toString() !== serverObjId.toString()) {
        // Cross-server swap detected
        isSwappingAcrossServers = true;
        oldServerId = oldChannelAnyServer.serverId;
        oldChannelId = oldChannelAnyServer._id;

        console.log(`[joinVoiceChannel] Cross-server swap detected: user ${userId} from server ${oldServerId} channel ${oldChannelId} to server ${serverId} channel ${channelId}`);

        // Remove user from old channel
        await db.collection('voiceChannels').updateOne(
          { _id: oldChannelId },
          { $pull: { activeMembers: userObjId } }
        );

        // Broadcast user left event to the OLD server
        await broadcastUserLeftVoiceChannel(
          db,
          oldServerId,
          oldChannelId,
          userObjId,
          user
        );
      } else if (!oldChannelAnyServer) {
        // User is not in any channel, just remove from all to be safe
        await db.collection('voiceChannels').updateMany(
          { serverId: serverObjId },
          { $pull: { activeMembers: userObjId } }
        );
      }
    }

    // Add user to this channel
    await db.collection('voiceChannels').updateOne(
      { _id: channelObjId },
      { $addToSet: { activeMembers: userObjId } }
    );

    // Broadcast appropriate event to NEW server
    if (isSwapping) {
      // Same-server swap already broadcasted via broadcastUserSwappedVoiceChannel
    } else if (isSwappingAcrossServers) {
      // Cross-server swap: broadcast joined event to new server
      await broadcastUserJoinedVoiceChannel(
        db,
        serverObjId,
        channelObjId,
        userObjId,
        user
      );
    } else {
      // Regular join
      await broadcastUserJoinedVoiceChannel(
        db,
        serverObjId,
        channelObjId,
        userObjId,
        user
      );
    }

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

    // Get user data for broadcast
    const user = await db.collection('users').findOne(
      { _id: userObjId },
      { projection: { username: 1, profilePicture: 1 } }
    );

    await db.collection('voiceChannels').updateOne(
      { _id: channelObjId },
      { $pull: { activeMembers: userObjId } }
    );

    // Broadcast leave event
    await broadcastUserLeftVoiceChannel(
      db,
      serverObjId,
      channelObjId,
      userObjId,
      user
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