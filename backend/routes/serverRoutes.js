const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/tokenMiddleware');

const {
  createServer,
  getServer,
  updateServer,
  deleteServer,
} = require('../controllers/serverController');

const {
  joinServer,
  leaveServer,
  getServerMembers,
  getServerMemberProfiles,
  getOnlineMembers,
  updateServerProfile,
  assignRole,
  removeRole,
} = require('../controllers/membershipController');

const {
  createRole,
  updateRole,
  deleteRole,
  getServerRoles,
} = require('../controllers/rolesController');

const {
  createVoiceChannel,
  getVoiceChannels,
  updateVoiceChannel,
  deleteVoiceChannel,
  joinVoiceChannel,
  leaveVoiceChannel,
} = require('../controllers/voiceChannelController');

const {
  createTextChannel,
  getTextChannels,
  updateTextChannel,
  deleteTextChannel,
} = require('../controllers/textChannelsController');

const {
  createInvite,
  createPersonalInvite,
  getInvites,
  revokeInvite,
} = require('../controllers/inviteController');

// server crud
router.post('/', verifyToken, createServer);
router.get('/:serverId', verifyToken, getServer);
router.patch('/:serverId', verifyToken, updateServer);
router.delete('/:serverId', verifyToken, deleteServer);

// server membership
router.post('/:serverId/join', verifyToken, joinServer);
router.delete('/:serverId/leave', verifyToken, leaveServer);
router.get('/:serverId/members', getServerMembers);

// ── NEW: enriched profiles & real-time online status ──────────────────────────
router.get('/:serverId/members/profiles', getServerMemberProfiles);
router.get('/:serverId/members/online', getOnlineMembers);
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/:serverId/profile/:userId', updateServerProfile);

// server role assignment
router.post('/:serverId/members/:userId/roles/:roleId', assignRole);
router.delete('/:serverId/members/:userId/roles/:roleId', removeRole);

// server roles crud
router.post('/:serverId/roles', createRole);
router.get('/:serverId/roles', getServerRoles);
router.patch('/:serverId/roles/:roleId', updateRole);
router.delete('/:serverId/roles/:roleId', deleteRole);

// voice channels
router.post('/:serverId/voiceChannels', createVoiceChannel);
router.get('/:serverId/voiceChannels', getVoiceChannels);
router.patch('/:serverId/voiceChannels/:channelId', updateVoiceChannel);
router.delete('/:serverId/voiceChannels/:channelId', deleteVoiceChannel);
router.post('/:serverId/voiceChannels/:channelId/join', joinVoiceChannel);
router.delete('/:serverId/voiceChannels/:channelId/leave', leaveVoiceChannel);

// text channels crud
router.post('/:serverId/textChannels', createTextChannel);
router.get('/:serverId/textChannels', getTextChannels);
router.patch('/:serverId/textChannels/:channelId', updateTextChannel);
router.delete('/:serverId/textChannels/:channelId', deleteTextChannel);

// server invites
router.post('/:serverId/invites', verifyToken, createInvite);
router.post('/:serverId/personal-invites', verifyToken, createPersonalInvite);
router.get('/:serverId/invites', verifyToken, getInvites);
router.delete('/:serverId/invites/:linkCode', verifyToken, revokeInvite);

module.exports = router;
