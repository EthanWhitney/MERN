const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

const parseRoleIds = (roleIds, fieldName) => {
  if (roleIds === undefined) return undefined;

  if (!Array.isArray(roleIds)) {
    const error = new Error(`${fieldName} must be an array of role IDs`);
    error.status = 400;
    throw error;
  }

  return [...new Set(roleIds)].map((roleId) => {
    if (!ObjectId.isValid(roleId)) {
      const error = new Error(`Invalid role ID in ${fieldName}`);
      error.status = 400;
      throw error;
    }

    return new ObjectId(roleId);
  });
};

const validateRolesBelongToServer = async (db, serverObjId, roleIds, fieldName) => {
  if (!roleIds || roleIds.length === 0) return;

  const matchingRoles = await db.collection('serverRoles').countDocuments({
    _id: { $in: roleIds },
    serverId: serverObjId,
  });

  if (matchingRoles !== roleIds.length) {
    const error = new Error(`One or more role IDs in ${fieldName} do not belong to this server`);
    error.status = 400;
    throw error;
  }
};

// POST /api/servers/:serverId/textChannels
const createTextChannel = async (req, res) => {
  const { serverId } = req.params;
  const { channelName, topic, viewRoles, textRoles } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ textChannel: null, error });
    }

    if (!channelName) {
      error = 'channelName is required';
      return res.status(400).json({ textChannel: null, error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const server = await db.collection('servers').findOne({ _id: serverObjId });

    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ textChannel: null, error });
    }

    const parsedViewRoles = parseRoleIds(viewRoles, 'viewRoles') ?? [];
    const parsedTextRoles = parseRoleIds(textRoles, 'textRoles') ?? [];

    await Promise.all([
      validateRolesBelongToServer(db, serverObjId, parsedViewRoles, 'viewRoles'),
      validateRolesBelongToServer(db, serverObjId, parsedTextRoles, 'textRoles'),
    ]);

    const newTextChannel = {
      serverId: serverObjId,
      channelName: channelName.trim(),
      topic: topic || '',
      viewRoles: parsedViewRoles,
      textRoles: parsedTextRoles,
      createdAt: new Date(),
    };

    const result = await db.collection('textChannels').insertOne(newTextChannel);

    await db.collection('servers').updateOne(
      { _id: serverObjId },
      { $push: { textChannels: result.insertedId } }
    );

    return res.status(201).json({
      textChannel: { ...newTextChannel, _id: result.insertedId },
      error: '',
    });
  } catch (e) {
    error = e.message || e.toString();
    return res.status(e.status || 500).json({ textChannel: null, error });
  }
};

// GET /api/servers/:serverId/textChannels
const getTextChannels = async (req, res) => {
  const { serverId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ textChannels: [], error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const server = await db.collection('servers').findOne({ _id: serverObjId });

    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ textChannels: [], error });
    }

    const textChannels = await db.collection('textChannels')
      .find({ serverId: serverObjId })
      .sort({ createdAt: 1 })
      .toArray();

    return res.status(200).json({ textChannels, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ textChannels: [], error });
  }
};

// PATCH /api/servers/:serverId/textChannels/:channelId
const updateTextChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  const { channelName, topic, viewRoles, textRoles } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ textChannel: null, error });
    }

    const updates = {};
    if (channelName !== undefined) updates.channelName = channelName.trim();
    if (topic !== undefined) updates.topic = topic;

    const parsedViewRoles = parseRoleIds(viewRoles, 'viewRoles');
    const parsedTextRoles = parseRoleIds(textRoles, 'textRoles');
    if (parsedViewRoles !== undefined) updates.viewRoles = parsedViewRoles;
    if (parsedTextRoles !== undefined) updates.textRoles = parsedTextRoles;

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);

    await Promise.all([
      validateRolesBelongToServer(db, serverObjId, parsedViewRoles, 'viewRoles'),
      validateRolesBelongToServer(db, serverObjId, parsedTextRoles, 'textRoles'),
    ]);

    const updatedChannel = await db.collection('textChannels').findOneAndUpdate(
      { _id: new ObjectId(channelId), serverId: serverObjId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!updatedChannel) {
      error = 'Text channel not found';
      return res.status(404).json({ textChannel: null, error });
    }

    return res.status(200).json({ textChannel: updatedChannel, error: '' });
  } catch (e) {
    error = e.message || e.toString();
    return res.status(e.status || 500).json({ textChannel: null, error });
  }
};

// DELETE /api/servers/:serverId/textChannels/:channelId
const deleteTextChannel = async (req, res) => {
  const { serverId, channelId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(channelId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ message: '', error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const channelObjId = new ObjectId(channelId);

    const existingChannel = await db.collection('textChannels').findOne({
      _id: channelObjId,
      serverId: serverObjId,
    });

    if (!existingChannel) {
      error = 'Text channel not found';
      return res.status(404).json({ message: '', error });
    }

    await Promise.all([
      db.collection('textChannels').deleteOne({ _id: channelObjId, serverId: serverObjId }),
      db.collection('servers').updateOne(
        { _id: serverObjId },
        { $pull: { textChannels: channelObjId } }
      ),
      db.collection('messages').deleteMany({ serverId: serverObjId, channelId: channelObjId }),
    ]);

    return res.status(200).json({ message: 'Text channel deleted successfully', error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ message: '', error });
  }
};

module.exports = {
  createTextChannel,
  getTextChannels,
  updateTextChannel,
  deleteTextChannel,
};
