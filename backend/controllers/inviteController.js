const { MongoClient, ObjectId } = require('mongodb');

require('dotenv').config();

const url = process.env.MONGODB_URI;
const client = new MongoClient(url);

if (!client.topology || !client.topology.isConnected()) {
  client.connect();
}

// Helper: Generate random 8-character alphanumeric code
const generateLinkCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// POST /api/servers/:serverId/invites
// Create a new invite link for a server
const createInvite = async (req, res) => {
  const { serverId } = req.params;
  const userId = req.userId;
  const { maxUses, expiresInDays } = req.body;

  try {
    if (!ObjectId.isValid(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);

    // Verify server exists and user is owner
    const server = await db.collection('servers').findOne({ _id: serverObjId });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (!server.ownerId.equals(userObjId)) {
      return res.status(403).json({ error: 'Only server owner can create invites' });
    }

    // Generate unique link code
    let linkCode = generateLinkCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.collection('serverInvites').findOne({ _id: linkCode });
      if (!existing) break;
      linkCode = generateLinkCode();
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique link code' });
    }

    // Build invite object
    const invite = {
      _id: linkCode,
      serverId: serverObjId,
      createdBy: userObjId,
      createdAt: new Date(),
      maxUses: maxUses || null,
      currentUses: 0,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
      isRevoked: false,
    };

    await db.collection('serverInvites').insertOne(invite);

    return res.status(201).json({
      linkCode,
      link: `/join/${linkCode}`,
      ...invite,
    });
  } catch (e) {
    const error = e.toString();
    return res.status(500).json({ error });
  }
};

// GET /api/servers/:serverId/invites
// Get all invites for a server (owner only)
const getInvites = async (req, res) => {
  const { serverId } = req.params;
  const userId = req.userId;

  try {
    if (!ObjectId.isValid(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID', invites: [] });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);

    // Verify server exists and user is owner
    const server = await db.collection('servers').findOne({ _id: serverObjId });
    if (!server) {
      return res.status(404).json({ error: 'Server not found', invites: [] });
    }

    if (!server.ownerId.equals(userObjId)) {
      return res.status(403).json({ error: 'Only server owner can view invites', invites: [] });
    }

    // Get all invites for this server
    const invites = await db.collection('serverInvites')
      .find({ serverId: serverObjId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({ invites, error: '' });
  } catch (e) {
    const error = e.toString();
    return res.status(500).json({ error, invites: [] });
  }
};

// DELETE /api/servers/:serverId/invites/:linkCode
// Revoke an invite link (owner only)
const revokeInvite = async (req, res) => {
  const { serverId, linkCode } = req.params;
  const userId = req.userId;

  try {
    if (!ObjectId.isValid(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);

    // Verify server exists and user is owner
    const server = await db.collection('servers').findOne({ _id: serverObjId });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (!server.ownerId.equals(userObjId)) {
      return res.status(403).json({ error: 'Only server owner can revoke invites' });
    }

    // Delete the invite
    const result = await db.collection('serverInvites').deleteOne(
      { _id: linkCode, serverId: serverObjId }
    );

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    return res.status(200).json({ success: true, error: '' });
  } catch (e) {
    const error = e.toString();
    return res.status(500).json({ error });
  }
};

// GET /api/invites/:linkCode
// Get invite metadata (public, no auth required)
const getInviteMetadata = async (req, res) => {
  const { linkCode } = req.params;

  try {
    const db = client.db('discord_clone');

    // Get invite
    const invite = await db.collection('serverInvites').findOne({ _id: linkCode });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if revoked
    if (invite.isRevoked) {
      await db.collection('serverInvites').deleteOne({ _id: linkCode });
      return res.status(410).json({ error: 'This invite has been revoked' });
    }

    // Check if expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      await db.collection('serverInvites').deleteOne({ _id: linkCode });
      return res.status(410).json({ error: 'This invite has expired' });
    }

    // Check if max uses reached
    if (invite.maxUses && invite.currentUses >= invite.maxUses) {
      await db.collection('serverInvites').deleteOne({ _id: linkCode });
      return res.status(410).json({ error: 'This invite has reached its maximum uses' });
    }

    // Get server details
    const server = await db.collection('servers').findOne(
      { _id: invite.serverId },
      { projection: { serverName: 1, description: 1, serverProfilePicture: 1, members: 1 } }
    );

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    return res.status(200).json({
      linkCode,
      serverId: invite.serverId.toString(),
      serverName: server.serverName,
      serverProfilePicture: server.serverProfilePicture,
      memberCount: server.members ? server.members.length : 0,
      usesRemaining: invite.maxUses ? invite.maxUses - invite.currentUses : null,
      expiresAt: invite.expiresAt,
      error: '',
    });
  } catch (e) {
    const error = e.toString();
    return res.status(500).json({ error });
  }
};

// POST /api/servers/:serverId/personal-invites
// Create a personal invite link for a specific user
const createPersonalInvite = async (req, res) => {
  const { serverId } = req.params;
  const userId = req.userId;
  const { recipientUserId } = req.body;

  try {
    if (!ObjectId.isValid(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }

    if (!ObjectId.isValid(recipientUserId)) {
      return res.status(400).json({ error: 'Invalid recipient user ID' });
    }

    const db = client.db('discord_clone');
    const serverObjId = new ObjectId(serverId);
    const userObjId = new ObjectId(userId);
    const recipientObjId = new ObjectId(recipientUserId);

    // Verify server exists and user is owner
    const server = await db.collection('servers').findOne({ _id: serverObjId });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (!server.ownerId.equals(userObjId)) {
      return res.status(403).json({ error: 'Only server owner can create invites' });
    }

    // Check if recipient is already a member
    const existingProfile = await db.collection('serverProfiles').findOne({
      userId: recipientObjId,
      serverId: serverObjId,
    });

    if (existingProfile) {
      return res.status(409).json({ error: 'User is already a member of this server' });
    }

    // Generate unique link code
    let linkCode = generateLinkCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.collection('serverInvites').findOne({ _id: linkCode });
      if (!existing) break;
      linkCode = generateLinkCode();
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique link code' });
    }

    // Build personal invite object
    const invite = {
      _id: linkCode,
      serverId: serverObjId,
      createdBy: userObjId,
      createdAt: new Date(),
      recipientUserId: recipientObjId,
      isPersonal: true,
      isRevoked: false,
    };

    await db.collection('serverInvites').insertOne(invite);

    return res.status(201).json({
      linkCode,
      link: `/join/${linkCode}`,
      message: 'Personal invite created successfully',
      error: '',
    });
  } catch (e) {
    const error = e.toString();
    return res.status(500).json({ error });
  }
};

// POST /api/invites/:linkCode/join
// Join server via invite link (requires auth)
const joinViaInvite = async (req, res) => {
  const { linkCode } = req.params;
  const userId = req.userId;

  try {
    const db = client.db('discord_clone');
    const userObjId = new ObjectId(userId);

    // Get invite
    const invite = await db.collection('serverInvites').findOne({ _id: linkCode });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if this is a personal invite - ensure only recipient can use it
    if (invite.isPersonal && invite.recipientUserId) {
      if (!invite.recipientUserId.equals(userObjId)) {
        return res.status(403).json({ error: 'This invite is not for you' });
      }
    }

    // Check if revoked
    if (invite.isRevoked) {
      await db.collection('serverInvites').deleteOne({ _id: linkCode });
      return res.status(410).json({ error: 'This invite has been revoked' });
    }

    // Check if expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      await db.collection('serverInvites').deleteOne({ _id: linkCode });
      return res.status(410).json({ error: 'This invite has expired' });
    }

    // Check if max uses reached (only for non-personal invites)
    if (!invite.isPersonal && invite.maxUses && invite.currentUses >= invite.maxUses) {
      await db.collection('serverInvites').deleteOne({ _id: linkCode });
      return res.status(410).json({ error: 'This invite has reached its maximum uses' });
    }

    const serverId = invite.serverId;

    // Check if user is already a member (check both serverProfiles and server.members)
    const existingProfile = await db.collection('serverProfiles').findOne({
      userId: userObjId,
      serverId,
    });

    // Also check if user is in the server members array (handles edge cases)
    const server = await db.collection('servers').findOne({ _id: serverId });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const isUserInMembers = server.members && server.members.some(memberId => {
      // Handle both string and ObjectId formats
      if (typeof memberId === 'string') {
        return memberId === userId || memberId === userObjId.toString();
      }
      return memberId.equals(userObjId);
    });

    if (existingProfile || isUserInMembers) {
      // User is already a member - just return success and server info
      return res.status(200).json({
        message: 'Already a member of this server',
        serverId: serverId.toString(),
        serverName: server ? server.serverName : 'Unknown',
        alreadyMember: true,
        error: '',
      });
    }

    // Get user data
    const user = await db.collection('users').findOne({ _id: userObjId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create server profile for new member
    const serverProfile = {
      userId: userObjId,
      serverId,
      serverSpecificName: user.username,
      serverProfilePicture: '',
      roles: [],
      joinedAt: new Date(),
    };

    await db.collection('serverProfiles').insertOne(serverProfile);

    // Add user to server members
    await db.collection('servers').updateOne(
      { _id: serverId },
      { $addToSet: { members: userObjId } }
    );

    // Add server to user's servers
    await db.collection('users').updateOne(
      { _id: userObjId },
      { $addToSet: { servers: serverId } }
    );

    // Increment invite uses (only non-personal invites)
    if (!invite.isPersonal) {
      await db.collection('serverInvites').updateOne(
        { _id: linkCode },
        { $inc: { currentUses: 1 } }
      );
    } else {
      // Delete personal invite after successful join
      await db.collection('serverInvites').deleteOne({ _id: linkCode });
    }

    return res.status(200).json({
      message: 'Successfully joined server',
      serverId: serverId.toString(),
      serverName: server.serverName,
      alreadyMember: false,
      error: '',
    });
  } catch (e) {
    const error = e.toString();
    return res.status(500).json({ error });
  }
};

module.exports = {
  createInvite,
  createPersonalInvite,
  getInvites,
  revokeInvite,
  getInviteMetadata,
  joinViaInvite,
};
