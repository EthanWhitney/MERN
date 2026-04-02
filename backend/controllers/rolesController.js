const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// POST /api/servers/:serverId/roles
const createRole = async (req, res) => {
  const { serverId } = req.params;
  const { roleName, roleColor, permissions } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ role: null, error });
    }
    if (!roleName) {
      error = 'roleName is required';
      return res.status(400).json({ role: null, error });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);

    const server = await db.collection('servers').findOne({ _id: serverObjId });
    if (!server) {
      error = 'Server not found';
      return res.status(404).json({ role: null, error });
    }

    const newRole = {
      serverId: serverObjId,
      roleName,
      roleColor: roleColor || '#99aab5',
      permissions: permissions || {},
      createdAt: new Date(),
    };

    const result = await db.collection('serverRoles').insertOne(newRole);

    await db.collection('servers').updateOne(
      { _id: serverObjId },
      { $push: { roles: result.insertedId } }
    );

    return res.status(201).json({
      role: { ...newRole, _id: result.insertedId },
      error: '',
    });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ role: null, error });
  }
};

// PATCH /api/servers/:serverId/roles/:roleId
const updateRole = async (req, res) => {
  const { serverId, roleId } = req.params;
  const { roleName, roleColor, permissions } = req.body;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(roleId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ role: null, error });
    }

    const updates = {};
    if (roleName !== undefined) updates.roleName = roleName;
    if (roleColor !== undefined) updates.roleColor = roleColor;
    if (permissions !== undefined) updates.permissions = permissions;

    const db = client.db('discord_clone');
    const result = await db.collection('serverRoles').findOneAndUpdate(
      { _id: new ObjectId(roleId), serverId: new ObjectId(serverId) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      error = 'Role not found';
      return res.status(404).json({ role: null, error });
    }

    return res.status(200).json({ role: result, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ role: null, error });
  }
};

// DELETE /api/servers/:serverId/roles/:roleId
const deleteRole = async (req, res) => {
  const { serverId, roleId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId) || !ObjectId.isValid(roleId)) {
      error = 'Invalid ID(s)';
      return res.status(400).json({ message: '', error });
    }

    const db = client.db('discord_clone');
    const roleObjId = new ObjectId(roleId);
    const serverObjId = new ObjectId(serverId);

    await Promise.all([
      db.collection('serverRoles').deleteOne({ _id: roleObjId, serverId: serverObjId }),
      db.collection('servers').updateOne(
        { _id: serverObjId },
        { $pull: { roles: roleObjId } }
      ),
      // Remove role from any member who had it assigned
      db.collection('serverProfiles').updateMany(
        { serverId: serverObjId },
        { $pull: { roles: roleObjId } }
      ),
    ]);

    return res.status(200).json({ message: 'Role deleted successfully', error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ message: '', error });
  }
};

// GET /api/servers/:serverId/roles
const getServerRoles = async (req, res) => {
  const { serverId } = req.params;
  let error = '';

  try {
    if (!ObjectId.isValid(serverId)) {
      error = 'Invalid server ID';
      return res.status(400).json({ roles: [], error });
    }

    const db = client.db('discord_clone');
    const roles = await db.collection('serverRoles')
      .find({ serverId: new ObjectId(serverId) })
      .toArray();

    return res.status(200).json({ roles, error: '' });
  } catch (e) {
    error = e.toString();
    return res.status(500).json({ roles: [], error });
  }
};

module.exports = { createRole, updateRole, deleteRole, getServerRoles };