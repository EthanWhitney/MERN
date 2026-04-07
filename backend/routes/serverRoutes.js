const express = require('express');
const router = express.Router();

const {
  createServer,
  getServer,
  updateServer,
  deleteServer,
  createTextChannel,
} = require('../controllers/serverController');

const {
  joinServer,
  leaveServer,
  getServerMembers,
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

// server crud
router.post('/', createServer);
router.get('/:serverId', getServer);
router.patch('/:serverId', updateServer);
router.delete('/:serverId', deleteServer);

// text channels
router.post('/:serverId/textChannels', createTextChannel);

// server membership
router.post('/:serverId/join', joinServer);
router.delete('/:serverId/leave', leaveServer);
router.get('/:serverId/members', getServerMembers);
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


module.exports = router;