const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/tokenMiddleware');

const {
	sendMessage,
	getMessages,
	updateMessage,
	deleteMessage,
	sendDirectMessage,
	getDirectMessages,
	updateDirectMessage,
	deleteDirectMessage,
	getDirectConversations,
} = require('../controllers/chatController');

// POST /api/servers/:serverId/textChannels/:channelId/messages
router.post('/api/servers/:serverId/textChannels/:channelId/messages', verifyToken, sendMessage);

// GET /api/servers/:serverId/textChannels/:channelId/messages
router.get('/api/servers/:serverId/textChannels/:channelId/messages', verifyToken, getMessages);

// PATCH /api/servers/:serverId/textChannels/:channelId/messages/:messageId
router.patch('/api/servers/:serverId/textChannels/:channelId/messages/:messageId', verifyToken, updateMessage);

// DELETE /api/servers/:serverId/textChannels/:channelId/messages/:messageId
router.delete('/api/servers/:serverId/textChannels/:channelId/messages/:messageId', verifyToken, deleteMessage);

// POST /api/chat/dms/:recipientId/messages
router.post('/api/chat/dms/:recipientId/messages', verifyToken, sendDirectMessage);

// GET /api/chat/dms
router.get('/api/chat/dms', verifyToken, getDirectConversations);

// GET /api/chat/dms/:recipientId/messages
router.get('/api/chat/dms/:recipientId/messages', verifyToken, getDirectMessages);

// PATCH /api/chat/dms/:recipientId/messages/:messageId
router.patch('/api/chat/dms/:recipientId/messages/:messageId', verifyToken, updateDirectMessage);

// DELETE /api/chat/dms/:recipientId/messages/:messageId
router.delete('/api/chat/dms/:recipientId/messages/:messageId', verifyToken, deleteDirectMessage);

module.exports = router;
